import { z } from "zod";

export const PRE_CHAT_FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "textarea",
  "select",
] as const;

export type PreChatFieldType = (typeof PRE_CHAT_FIELD_TYPES)[number];

export type PreChatField = {
  id: string;
  label: string;
  type: PreChatFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
};

export type PreChatFormConfig = {
  enabled: boolean;
  title?: string;
  description?: string;
  submitLabel?: string;
  fields: PreChatField[];
};

export const DEFAULT_PRE_CHAT_FORM: PreChatFormConfig = {
  enabled: false,
  title: "Before we begin",
  description: "Please share a few details so we can assist you better.",
  submitLabel: "Continue",
  fields: [],
};

const preChatFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(PRE_CHAT_FIELD_TYPES),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string().min(1)).optional(),
});

export const preChatFormConfigSchema = z.object({
  enabled: z.boolean(),
  title: z.string().optional(),
  description: z.string().optional(),
  submitLabel: z.string().optional(),
  fields: z.array(preChatFieldSchema),
});

export function resolvePreChatForm(
  config: PreChatFormConfig | undefined,
): PreChatFormConfig {
  if (!config) {
    return { ...DEFAULT_PRE_CHAT_FORM };
  }

  return {
    ...DEFAULT_PRE_CHAT_FORM,
    ...config,
    fields: config.fields ?? [],
  };
}

export function isPreChatFormActive(config: PreChatFormConfig | undefined) {
  const resolved = resolvePreChatForm(config);
  return resolved.enabled && resolved.fields.length > 0;
}

export function buildPreChatResponseSchema(config: PreChatFormConfig) {
  const shape: Record<string, z.ZodType<string>> = {};

  for (const field of config.fields) {
    if (field.type === "select" && field.options?.length) {
      const selectSchema = z.enum(field.options as [string, ...string[]], {
        message: `Select a valid ${field.label.toLowerCase()}`,
      });
      shape[field.id] = field.required
        ? selectSchema
        : z.union([selectSchema, z.literal("")]);
      continue;
    }

    let validator = z.string().trim();

    if (field.type === "email") {
      validator = validator.email("Enter a valid email address");
    }

    shape[field.id] = field.required
      ? validator.min(1, `${field.label} is required`)
      : z.union([validator, z.literal("")]);
  }

  return z.object(shape);
}

export function formatPreChatResponsesForPrompt(input: {
  config: PreChatFormConfig;
  responses: Record<string, string>;
}): string {
  const lines = input.config.fields
    .map((field) => {
      const value = input.responses[field.id]?.trim();
      if (!value) {
        return null;
      }
      return `- ${field.label}: ${value}`;
    })
    .filter((line): line is string => line !== null);

  if (lines.length === 0) {
    return "";
  }

  return `## Visitor information\nThe visitor provided the following details before starting the conversation:\n${lines.join("\n")}`;
}

export function getPreChatStorageKey(agentId: string, visitorId: string) {
  return `losono_prechat_${agentId}_${visitorId}`;
}
