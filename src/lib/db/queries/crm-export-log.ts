import { and, count, eq, notExists } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  type CrmExportStatus,
  crmExportLog,
  formSubmissions,
} from "@/lib/db/schema";

export async function upsertCrmExportLogEntry(input: {
  submissionId: string;
  integrationId: string;
  agentId: string;
  status: CrmExportStatus;
  crmLeadId?: string | null;
  error?: string | null;
}): Promise<void> {
  const now = new Date();
  const exportedAt =
    input.status === "success" || input.status === "skipped" ? now : null;

  await getDb()
    .insert(crmExportLog)
    .values({
      submissionId: input.submissionId,
      integrationId: input.integrationId,
      agentId: input.agentId,
      status: input.status,
      crmLeadId: input.crmLeadId ?? null,
      error: input.error ?? null,
      exportedAt,
    })
    .onConflictDoUpdate({
      target: [crmExportLog.submissionId, crmExportLog.integrationId],
      set: {
        status: input.status,
        crmLeadId: input.crmLeadId ?? null,
        error: input.error ?? null,
        exportedAt,
      },
    });
}

export async function listUnexportedSubmissionsForAgent(
  agentId: string,
  integrationId: string,
) {
  return getDb()
    .select()
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.agentId, agentId),
        notExists(
          getDb()
            .select({ id: crmExportLog.id })
            .from(crmExportLog)
            .where(
              and(
                eq(crmExportLog.submissionId, formSubmissions.id),
                eq(crmExportLog.integrationId, integrationId),
                eq(crmExportLog.status, "success"),
              ),
            ),
        ),
      ),
    );
}

export async function listFailedSubmissionsForAgent(
  agentId: string,
  integrationId: string,
) {
  return getDb()
    .select({ submissionId: crmExportLog.submissionId })
    .from(crmExportLog)
    .where(
      and(
        eq(crmExportLog.agentId, agentId),
        eq(crmExportLog.integrationId, integrationId),
        eq(crmExportLog.status, "failed"),
      ),
    );
}

export async function getCrmExportStatsForAgent(
  agentId: string,
  integrationId: string,
) {
  const db = getDb();

  const [totalRow] = await db
    .select({ total: count() })
    .from(formSubmissions)
    .where(eq(formSubmissions.agentId, agentId));

  const statusCounts = await db
    .select({
      status: crmExportLog.status,
      total: count(),
    })
    .from(crmExportLog)
    .where(
      and(
        eq(crmExportLog.agentId, agentId),
        eq(crmExportLog.integrationId, integrationId),
      ),
    )
    .groupBy(crmExportLog.status);

  const byStatus = Object.fromEntries(
    statusCounts.map((row) => [row.status, row.total]),
  ) as Partial<Record<CrmExportStatus, number>>;

  const exported = byStatus.success ?? 0;
  const failed = byStatus.failed ?? 0;
  const skipped = byStatus.skipped ?? 0;
  const total = totalRow?.total ?? 0;
  const pending = Math.max(total - exported - skipped, 0);

  return { total, exported, failed, skipped, pending };
}
