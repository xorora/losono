import type { CrmFieldMapping } from "@/lib/db/schema";
import type { SalesCrmField } from "@/lib/integrations/sales-crm/types";
import type { PreChatField, PreChatFieldType } from "@/lib/pre-chat-form";

const PRE_CHAT_TO_CRM_TYPES: Record<PreChatFieldType, string[]> = {
  email: ["EMAIL"],
  phone: ["PHONE"],
  text: ["TEXT", "TEXTAREA"],
  textarea: ["TEXTAREA", "TEXT"],
  select: ["SELECT", "TEXT"],
};

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findCompatibleCrmField(
  preChatField: PreChatField,
  crmFields: SalesCrmField[],
  usedKeys: Set<string>,
): SalesCrmField | undefined {
  const compatibleTypes = PRE_CHAT_TO_CRM_TYPES[preChatField.type];
  const normalizedLabel = normalizeLabel(preChatField.label);

  const exactLabelMatch = crmFields.find(
    (crmField) =>
      !usedKeys.has(crmField.key) &&
      compatibleTypes.includes(crmField.type) &&
      normalizeLabel(crmField.label) === normalizedLabel,
  );

  if (exactLabelMatch) {
    return exactLabelMatch;
  }

  const fuzzyMatch = crmFields.find((crmField) => {
    if (
      usedKeys.has(crmField.key) ||
      !compatibleTypes.includes(crmField.type)
    ) {
      return false;
    }

    const normalizedKey = normalizeLabel(crmField.key);
    const normalizedCrmLabel = normalizeLabel(crmField.label);

    return (
      normalizedKey === normalizedLabel ||
      normalizedCrmLabel.includes(normalizedLabel) ||
      normalizedLabel.includes(normalizedCrmLabel)
    );
  });

  if (fuzzyMatch) {
    return fuzzyMatch;
  }

  if (preChatField.type === "email" || preChatField.type === "phone") {
    return crmFields.find(
      (crmField) =>
        !usedKeys.has(crmField.key) && crmField.type === compatibleTypes[0],
    );
  }

  return undefined;
}

export function suggestFieldMapping(
  preChatFields: PreChatField[],
  crmFields: SalesCrmField[],
): CrmFieldMapping {
  const mapping: CrmFieldMapping = {};
  const usedKeys = new Set<string>();

  for (const field of preChatFields) {
    const match = findCompatibleCrmField(field, crmFields, usedKeys);

    if (match) {
      mapping[field.id] = match.key;
      usedKeys.add(match.key);
    }
  }

  return mapping;
}

export function isFieldMappingReady(
  preChatFields: PreChatField[],
  mapping: CrmFieldMapping,
): boolean {
  if (preChatFields.length === 0) {
    return false;
  }

  return preChatFields.some((field) => Boolean(mapping[field.id]?.trim()));
}

export function transformSubmissionResponses(
  responses: Record<string, string>,
  mapping: CrmFieldMapping,
): Record<string, string> {
  const fieldValues: Record<string, string> = {};

  for (const [fieldId, crmKey] of Object.entries(mapping)) {
    if (!crmKey.trim()) {
      continue;
    }

    const value = responses[fieldId];
    if (value !== undefined && value !== "") {
      fieldValues[crmKey] = value;
    }
  }

  return fieldValues;
}
