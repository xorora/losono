import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  type CrmFieldMapping,
  type CrmFieldMappingRow,
  crmFieldMappings,
} from "@/lib/db/schema";

export async function getCrmFieldMappingForAgent(
  integrationId: string,
  agentId: string,
): Promise<CrmFieldMappingRow | null> {
  const [row] = await getDb()
    .select()
    .from(crmFieldMappings)
    .where(
      and(
        eq(crmFieldMappings.integrationId, integrationId),
        eq(crmFieldMappings.agentId, agentId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function upsertCrmFieldMapping(input: {
  integrationId: string;
  agentId: string;
  mapping: CrmFieldMapping;
}): Promise<CrmFieldMappingRow> {
  const existing = await getCrmFieldMappingForAgent(
    input.integrationId,
    input.agentId,
  );
  const now = new Date();

  if (existing) {
    const [updated] = await getDb()
      .update(crmFieldMappings)
      .set({
        mapping: input.mapping,
        updatedAt: now,
      })
      .where(eq(crmFieldMappings.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update CRM field mapping");
    }

    return updated;
  }

  const [created] = await getDb()
    .insert(crmFieldMappings)
    .values({
      integrationId: input.integrationId,
      agentId: input.agentId,
      mapping: input.mapping,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create CRM field mapping");
  }

  return created;
}
