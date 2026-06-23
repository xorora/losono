import { getAgentById, getAgentForUser } from "@/lib/db/queries/agents";
import {
  getCrmExportStatsForAgent,
  listFailedSubmissionsForAgent,
  listUnexportedSubmissionsForAgent,
  upsertCrmExportLogEntry,
} from "@/lib/db/queries/crm-export-log";
import { getCrmFieldMappingForAgent } from "@/lib/db/queries/crm-field-mappings";
import {
  getCrmIntegrationForUser,
  isCrmIntegrationConnected,
  updateCrmIntegrationSyncState,
} from "@/lib/db/queries/crm-integrations";
import { getFormSubmissionById } from "@/lib/db/queries/form-submissions";
import type { CrmIntegration } from "@/lib/db/schema";
import {
  createSalesCrmLead,
  createSalesCrmLeadsBulk,
} from "@/lib/integrations/sales-crm/client";
import { SalesCrmError } from "@/lib/integrations/sales-crm/errors";
import {
  isFieldMappingReady,
  transformSubmissionResponses,
} from "@/lib/integrations/sales-crm/field-mapping";
import { isTokenEncryptionAvailable } from "@/lib/integrations/token-encryption";
import { resolvePreChatForm } from "@/lib/pre-chat-form";

const BULK_EXPORT_CHUNK_SIZE = 50;

export type ExportAllResult = {
  imported: number;
  skipped: number;
  failed: number;
};

async function loadExportContext(userId: string, agentId: string) {
  const [integration, agent] = await Promise.all([
    getCrmIntegrationForUser(userId),
    getAgentForUser(agentId, userId),
  ]);

  if (!integration) {
    throw new SalesCrmError("Sales CRM is not connected", "not_connected");
  }

  if (!agent) {
    throw new SalesCrmError("Agent not found", "agent_not_found", 404);
  }

  if (!integration.campaignId) {
    throw new SalesCrmError(
      "Select a Sales CRM campaign before exporting",
      "campaign_required",
    );
  }

  const mappingRow = await getCrmFieldMappingForAgent(integration.id, agentId);
  const preChatForm = resolvePreChatForm(agent.settings.preChatForm);

  if (
    !mappingRow ||
    !isFieldMappingReady(preChatForm.fields, mappingRow.mapping)
  ) {
    throw new SalesCrmError(
      "Complete field mapping before exporting",
      "mapping_incomplete",
    );
  }

  return {
    integration,
    agent,
    mapping: mappingRow.mapping,
    campaignId: integration.campaignId,
  };
}

async function resolveExportContext(input: {
  userId: string;
  agentId: string;
  integration?: CrmIntegration;
  mapping?: Record<string, string>;
  campaignId?: string;
}) {
  if (!input.integration) {
    return loadExportContext(input.userId, input.agentId);
  }

  if (!input.mapping) {
    throw new SalesCrmError(
      "Complete field mapping before exporting",
      "mapping_incomplete",
    );
  }

  if (!input.campaignId) {
    throw new SalesCrmError(
      "Select a Sales CRM campaign before exporting",
      "campaign_required",
    );
  }

  return {
    integration: input.integration,
    mapping: input.mapping,
    campaignId: input.campaignId,
  };
}

export async function exportSubmission(input: {
  userId: string;
  agentId: string;
  submissionId: string;
  integration?: CrmIntegration;
  mapping?: Record<string, string>;
  campaignId?: string;
}): Promise<{ status: "success" | "skipped" | "failed"; crmLeadId?: string }> {
  const context = await resolveExportContext(input);

  const submission = await getFormSubmissionById(
    input.agentId,
    input.submissionId,
  );

  if (!submission) {
    throw new SalesCrmError(
      "Submission not found",
      "submission_not_found",
      404,
    );
  }

  const fieldValues = transformSubmissionResponses(
    submission.responses,
    context.mapping,
  );

  fieldValues.losono_submission_id = submission.id;

  try {
    const result = await createSalesCrmLead(input.userId, {
      campaignId: context.campaignId,
      fieldValues,
      idempotencyKey: submission.id,
    });

    const status = result.created ? "success" : "skipped";

    await upsertCrmExportLogEntry({
      submissionId: submission.id,
      integrationId: context.integration.id,
      agentId: input.agentId,
      status,
      crmLeadId: result.id,
    });

    return { status, crmLeadId: result.id };
  } catch (error) {
    const message =
      error instanceof SalesCrmError
        ? error.message
        : "Failed to export submission";

    await upsertCrmExportLogEntry({
      submissionId: submission.id,
      integrationId: context.integration.id,
      agentId: input.agentId,
      status: "failed",
      error: message,
    });

    throw error;
  }
}

export async function exportAllForAgent(
  userId: string,
  agentId: string,
): Promise<ExportAllResult> {
  const context = await loadExportContext(userId, agentId);
  const submissions = await listUnexportedSubmissionsForAgent(
    agentId,
    context.integration.id,
  );

  if (submissions.length === 0) {
    return { imported: 0, skipped: 0, failed: 0 };
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (
    let index = 0;
    index < submissions.length;
    index += BULK_EXPORT_CHUNK_SIZE
  ) {
    const chunk = submissions.slice(index, index + BULK_EXPORT_CHUNK_SIZE);

    try {
      const bulkResult = await createSalesCrmLeadsBulk(userId, {
        campaignId: context.campaignId,
        leads: chunk.map((submission) => ({
          fieldValues: {
            ...transformSubmissionResponses(
              submission.responses,
              context.mapping,
            ),
            losono_submission_id: submission.id,
          },
          idempotencyKey: submission.id,
        })),
      });

      imported += bulkResult.imported;
      skipped += bulkResult.skipped;
      failed += bulkResult.failed;

      await Promise.all(
        bulkResult.results.map(async (result, resultIndex) => {
          const submission = chunk[resultIndex];
          if (!submission) {
            return;
          }

          if (result.status === "created" || result.status === "skipped") {
            await upsertCrmExportLogEntry({
              submissionId: submission.id,
              integrationId: context.integration.id,
              agentId,
              status: result.status === "created" ? "success" : "skipped",
              crmLeadId: result.id ?? null,
            });
            return;
          }

          await upsertCrmExportLogEntry({
            submissionId: submission.id,
            integrationId: context.integration.id,
            agentId,
            status: "failed",
            error: result.error ?? "Bulk export failed",
          });
        }),
      );
    } catch (error) {
      const message =
        error instanceof SalesCrmError
          ? error.message
          : "Bulk export request failed";

      failed += chunk.length;

      await Promise.all(
        chunk.map((submission) =>
          upsertCrmExportLogEntry({
            submissionId: submission.id,
            integrationId: context.integration.id,
            agentId,
            status: "failed",
            error: message,
          }),
        ),
      );
    }
  }

  await updateCrmIntegrationSyncState(context.integration.id, {
    lastSyncAt: new Date(),
    lastError: failed > 0 ? `${failed} submission(s) failed to export` : null,
  });

  return { imported, skipped, failed };
}

export async function getExportSummaryForAgent(
  userId: string,
  agentId: string,
) {
  const integration = await getCrmIntegrationForUser(userId);

  if (!integration) {
    return null;
  }

  return getCrmExportStatsForAgent(agentId, integration.id);
}

export async function syncNewSubmission(
  agentId: string,
  submissionId: string,
): Promise<void> {
  if (!isTokenEncryptionAvailable()) {
    return;
  }

  const agent = await getAgentById(agentId);
  if (!agent) {
    return;
  }

  const integration = await getCrmIntegrationForUser(agent.userId);
  if (
    !integration ||
    !isCrmIntegrationConnected(integration) ||
    !integration.syncEnabled ||
    !integration.campaignId
  ) {
    return;
  }

  const mappingRow = await getCrmFieldMappingForAgent(integration.id, agentId);
  const preChatForm = resolvePreChatForm(agent.settings.preChatForm);

  if (
    !mappingRow ||
    !isFieldMappingReady(preChatForm.fields, mappingRow.mapping)
  ) {
    return;
  }

  try {
    await exportSubmission({
      userId: agent.userId,
      agentId,
      submissionId,
      integration,
      mapping: mappingRow.mapping,
      campaignId: integration.campaignId,
    });

    await updateCrmIntegrationSyncState(integration.id, {
      lastSyncAt: new Date(),
      lastError: null,
    });
  } catch (error) {
    const message =
      error instanceof SalesCrmError ? error.message : "Auto-sync failed";

    console.error("Sales CRM auto-sync failed:", error);

    await updateCrmIntegrationSyncState(integration.id, {
      lastError: message,
    });
  }
}

export async function retryFailedForAgent(
  userId: string,
  agentId: string,
): Promise<ExportAllResult> {
  const context = await loadExportContext(userId, agentId);
  const failedSubmissions = await listFailedSubmissionsForAgent(
    agentId,
    context.integration.id,
  );

  if (failedSubmissions.length === 0) {
    return { imported: 0, skipped: 0, failed: 0 };
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const { submissionId } of failedSubmissions) {
    try {
      const result = await exportSubmission({
        userId,
        agentId,
        submissionId,
        integration: context.integration,
        mapping: context.mapping,
        campaignId: context.campaignId,
      });

      if (result.status === "success") {
        imported += 1;
      } else {
        skipped += 1;
      }
    } catch {
      failed += 1;
    }
  }

  await updateCrmIntegrationSyncState(context.integration.id, {
    lastSyncAt: new Date(),
    lastError: failed > 0 ? `${failed} submission(s) failed to export` : null,
  });

  return { imported, skipped, failed };
}
