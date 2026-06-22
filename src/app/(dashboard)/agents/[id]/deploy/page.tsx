import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { ApiKeysManager } from "@/components/deploy/api-keys-manager";
import { ConversationLogs } from "@/components/deploy/conversation-logs";
import { EmbedSettings } from "@/components/deploy/embed-settings";
import { PublishActions } from "@/components/deploy/publish-actions";
import { UsagePanel } from "@/components/deploy/usage-panel";
import { getAppUrl } from "@/lib/app-url";
import { getAgentForUser } from "@/lib/db/queries/agents";
import { listApiKeysForAgent } from "@/lib/db/queries/api-keys";
import {
  getAgentUsageSummary,
  listConversationLogs,
} from "@/lib/db/queries/usage";
import { resolveWidgetTheme } from "@/lib/widget-theme";

type DeployPageProps = {
  params: Promise<{ id: string }>;
};

function DeployFallback() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}

async function DeployContent({ params }: DeployPageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    notFound();
  }

  const agent = await getAgentForUser(id, userId);
  if (!agent) {
    notFound();
  }

  const [usage, conversations, apiKeys] = await Promise.all([
    getAgentUsageSummary(agent.id),
    listConversationLogs({ agentId: agent.id }),
    listApiKeysForAgent(agent.id),
  ]);

  const theme = resolveWidgetTheme(agent.settings.widgetTheme, {
    agentName: agent.name,
  });
  const published = agent.status === "published";
  const canPublish = agent.userPrompt.trim().length > 0;
  const appUrl = getAppUrl();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Agent</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {agent.name}
          </h1>
          <p className="text-muted-foreground">
            Deploy ·{" "}
            <span className="capitalize text-foreground">{agent.status}</span>
            {agent.publishedAt
              ? ` · Published ${agent.publishedAt.toLocaleString()}`
              : ""}
          </p>
        </div>
        <PublishActions
          agentId={agent.id}
          status={agent.status}
          canPublish={canPublish}
        />
      </div>

      <UsagePanel usage={usage} />

      <EmbedSettings
        agentId={agent.id}
        slug={agent.slug}
        appUrl={appUrl}
        published={published}
        initialGreeting={theme.greeting}
        initialPosition={theme.position}
        initialAllowedOrigins={(agent.settings.allowedOrigins ?? []).join("\n")}
        initialModes={theme.modes}
        initialAppearance={{
          backgroundColor: theme.backgroundColor,
          userFontColor: theme.userFontColor,
          assistantFontColor: theme.assistantFontColor,
          userBubbleColor: theme.userBubbleColor,
          assistantBubbleColor: theme.assistantBubbleColor,
          sendButtonColor: theme.sendButtonColor,
          sendButtonIconColor: theme.sendButtonIconColor,
          windowBorderColor: theme.windowBorderColor,
          launcherBorderColor: theme.launcherBorderColor,
          logoUrl: theme.logoUrl,
        }}
      />

      <ApiKeysManager
        agentId={agent.id}
        published={published}
        initialKeys={apiKeys.map((key) => ({
          id: key.id,
          name: key.name,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
        }))}
      />

      <ConversationLogs
        agentId={agent.id}
        initialConversations={conversations.map((conversation) => ({
          id: conversation.id,
          mode: conversation.mode,
          visitorId: conversation.visitorId,
          createdAt: conversation.createdAt,
          messageCount: Number(conversation.messageCount),
        }))}
      />
    </div>
  );
}

export default function DeployPage({ params }: DeployPageProps) {
  return (
    <Suspense fallback={<DeployFallback />}>
      <DeployContent params={params} />
    </Suspense>
  );
}
