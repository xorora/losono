import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AgentSettingsForm } from "@/components/dashboard/agent-settings-form";
import { getSubscriptionWithStripeSync } from "@/lib/billing/sync-subscription";
import { getAgentForUser } from "@/lib/db/queries/agents";

type AgentSettingsPageProps = {
  params: Promise<{ id: string }>;
};

function SettingsFallback() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}

async function SettingsContent({ params }: AgentSettingsPageProps) {
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

  const subscription = await getSubscriptionWithStripeSync(
    userId,
    session?.user?.email,
  );
  const voiceAvailable = subscription?.voiceEnabled ?? false;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Agent</p>
        <h1 className="text-3xl font-semibold tracking-tight">{agent.name}</h1>
        <p className="text-muted-foreground">Settings</p>
      </div>

      <AgentSettingsForm
        agentId={agent.id}
        initialName={agent.name}
        initialVoiceEnabled={agent.voiceEnabled}
        voiceAvailable={voiceAvailable}
      />
    </div>
  );
}

export default function AgentSettingsPage({ params }: AgentSettingsPageProps) {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsContent params={params} />
    </Suspense>
  );
}
