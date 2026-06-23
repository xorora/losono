import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { FormSubmissionsPanel } from "@/components/deploy/form-submissions-panel";
import { PreChatFormSettings } from "@/components/deploy/pre-chat-form-settings";
import { SalesCrmExportPanel } from "@/components/deploy/sales-crm-export-panel";
import { getAgentForUser } from "@/lib/db/queries/agents";
import {
  getCrmIntegrationForUser,
  getInitialSalesCrmBaseUrl,
  isCrmIntegrationConnected,
  serializeCrmIntegration,
} from "@/lib/db/queries/crm-integrations";
import { listFormSubmissionsForAgent } from "@/lib/db/queries/form-submissions";
import { listSalesCrmCampaigns } from "@/lib/integrations/sales-crm/client";
import { getDefaultSalesCrmBaseUrl } from "@/lib/integrations/sales-crm/config";
import { isTokenEncryptionAvailable } from "@/lib/integrations/token-encryption";
import { resolvePreChatForm } from "@/lib/pre-chat-form";

type FormsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ crm?: string; crm_error?: string }>;
};

function FormsFallback() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}

async function loadSalesCrmInitialState(userId: string) {
  const platformReady = isTokenEncryptionAvailable();
  const defaultSalesCrmUrl = getDefaultSalesCrmBaseUrl();
  const integration = await getCrmIntegrationForUser(userId);
  const connected = integration
    ? isCrmIntegrationConnected(integration)
    : false;

  if (!integration || !connected) {
    return {
      platformReady,
      defaultSalesCrmUrl,
      connected: false,
      integration: integration ? serializeCrmIntegration(integration) : null,
      campaigns: [] as Awaited<ReturnType<typeof listSalesCrmCampaigns>>,
      initialSalesCrmUrl: getInitialSalesCrmBaseUrl(integration),
    };
  }

  try {
    const campaigns = await listSalesCrmCampaigns(userId);

    return {
      platformReady,
      defaultSalesCrmUrl,
      connected: true,
      integration: serializeCrmIntegration(integration),
      campaigns,
      initialSalesCrmUrl: getInitialSalesCrmBaseUrl(integration),
    };
  } catch (error) {
    console.error("Failed to preload Sales CRM campaigns:", error);

    return {
      platformReady,
      defaultSalesCrmUrl,
      connected: true,
      integration: serializeCrmIntegration(integration),
      campaigns: [] as Awaited<ReturnType<typeof listSalesCrmCampaigns>>,
      initialSalesCrmUrl: getInitialSalesCrmBaseUrl(integration),
    };
  }
}

async function FormsContent({ params, searchParams }: FormsPageProps) {
  const { id } = await params;
  const { crm, crm_error: crmError } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    notFound();
  }

  const agent = await getAgentForUser(id, userId);
  if (!agent) {
    notFound();
  }

  const [formSubmissions, preChatForm, salesCrmState] = await Promise.all([
    listFormSubmissionsForAgent(agent.id),
    Promise.resolve(resolvePreChatForm(agent.settings.preChatForm)),
    loadSalesCrmInitialState(userId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Agent</p>
        <h1 className="text-3xl font-semibold tracking-tight">{agent.name}</h1>
        <p className="text-muted-foreground">
          Forms · Collect visitor details before chat or voice
        </p>
      </div>

      <PreChatFormSettings agentId={agent.id} initialConfig={preChatForm} />

      <SalesCrmExportPanel
        agentId={agent.id}
        preChatFields={preChatForm.fields}
        platformReady={salesCrmState.platformReady}
        defaultSalesCrmUrl={salesCrmState.defaultSalesCrmUrl}
        initialSalesCrmUrl={salesCrmState.initialSalesCrmUrl}
        initialConnected={salesCrmState.connected}
        initialIntegration={salesCrmState.integration}
        initialCampaigns={salesCrmState.campaigns}
        crmStatus={crm}
        crmError={crmError}
      />

      <FormSubmissionsPanel
        fields={preChatForm.fields}
        submissions={formSubmissions.map((submission) => ({
          id: submission.id,
          visitorId: submission.visitorId,
          responses: submission.responses,
          createdAt: submission.createdAt,
        }))}
      />
    </div>
  );
}

export default function FormsPage({ params, searchParams }: FormsPageProps) {
  return (
    <Suspense fallback={<FormsFallback />}>
      <FormsContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
