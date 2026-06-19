import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AgentPromptForm } from "@/components/dashboard/agent-prompt-form";
import { getAgentForUser } from "@/lib/db/queries/agents";

type PromptPageProps = {
  params: Promise<{ id: string }>;
};

function PromptFallback() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-muted/40" />
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-muted/40" />
      </div>
    </div>
  );
}

async function PromptContent({ params }: PromptPageProps) {
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Agent</p>
        <h1 className="text-3xl font-semibold tracking-tight">{agent.name}</h1>
        <p className="text-muted-foreground">Prompt</p>
      </div>

      <AgentPromptForm
        agentId={agent.id}
        initialUserPrompt={agent.userPrompt}
      />
    </div>
  );
}

export default function AgentPromptPage({ params }: PromptPageProps) {
  return (
    <Suspense fallback={<PromptFallback />}>
      <PromptContent params={params} />
    </Suspense>
  );
}
