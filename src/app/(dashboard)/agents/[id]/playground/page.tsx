import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AgentChat } from "@/components/chat/agent-chat";
import { PublishActions } from "@/components/deploy/publish-actions";
import { Button } from "@/components/ui/button";
import { AgentVoice } from "@/components/voice/agent-voice";
import { getSubscriptionByUserId } from "@/lib/billing/subscriptions";
import { canUseVoiceInPlayground } from "@/lib/billing/voice-access";
import { getAgentForUser } from "@/lib/db/queries/agents";

type PlaygroundPageProps = {
  params: Promise<{ id: string }>;
};

function PlaygroundFallback() {
  return (
    <div className="mx-auto flex h-[calc(100svh-3.5rem)] w-full max-w-6xl flex-col gap-6 overflow-hidden p-6 md:p-8">
      <div className="h-40 shrink-0 animate-pulse rounded-2xl border border-border bg-muted/40" />
      <div className="grid min-h-0 flex-1 grid-rows-2 gap-6 xl:grid-cols-2 xl:grid-rows-1">
        <div className="min-h-0 animate-pulse rounded-2xl border border-border bg-muted/40" />
        <div className="min-h-0 animate-pulse rounded-2xl border border-border bg-muted/40" />
      </div>
    </div>
  );
}

async function PlaygroundContent({ params }: PlaygroundPageProps) {
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

  const subscription = await getSubscriptionByUserId(userId);
  const voiceAccess = canUseVoiceInPlayground(subscription, agent);
  const canPublish = agent.userPrompt.trim().length > 0;

  return (
    <div className="mx-auto flex h-[calc(100svh-3.5rem)] w-full max-w-6xl flex-col gap-6 overflow-hidden p-6 md:p-8">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Agent</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {agent.name}
          </h1>
          <p className="text-muted-foreground">Playground</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {agent.status === "published" && (
            <Button asChild variant="outline">
              <Link href={`/agents/${agent.id}/deploy`}>Deploy</Link>
            </Button>
          )}
          <PublishActions
            agentId={agent.id}
            status={agent.status}
            canPublish={canPublish}
          />
        </div>
      </div>

      <div className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        Sandbox mode — this agent is not live. Chat is available on all plans;
        voice requires Pro.
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-2 gap-6 xl:grid-cols-2 xl:grid-rows-1">
        <div className="min-h-0">
          <AgentChat agentId={agent.id} agentName={agent.name} />
        </div>

        <div className="min-h-0">
          <AgentVoice
            agentId={agent.id}
            agentName={agent.name}
            voiceAvailable={voiceAccess.allowed}
            voiceBlockedReason={
              voiceAccess.allowed ? undefined : voiceAccess.reason
            }
          />
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage({ params }: PlaygroundPageProps) {
  return (
    <Suspense fallback={<PlaygroundFallback />}>
      <PlaygroundContent params={params} />
    </Suspense>
  );
}
