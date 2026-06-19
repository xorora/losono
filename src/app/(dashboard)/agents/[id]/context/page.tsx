import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { ContextManager } from "@/components/dashboard/context-manager";
import { getSubscriptionWithStripeSync } from "@/lib/billing/sync-subscription";
import { getAgentForUser } from "@/lib/db/queries/agents";
import {
  getContextFileLimit,
  listContextSources,
} from "@/lib/db/queries/context";
import { MAX_CONTEXT_FILE_BYTES } from "@/lib/rag/constants";
import { listAllowedMimeTypes } from "@/lib/rag/mime";

type ContextPageProps = {
  params: Promise<{ id: string }>;
};

function ContextFallback() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}

async function ContextContent({ params }: ContextPageProps) {
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

  const [subscription, sources] = await Promise.all([
    getSubscriptionWithStripeSync(userId, session?.user?.email),
    listContextSources(agent.id),
  ]);

  const limit = getContextFileLimit(subscription);
  const used = sources.length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Agent</p>
        <h1 className="text-3xl font-semibold tracking-tight">{agent.name}</h1>
        <p className="text-muted-foreground">Context</p>
      </div>

      <ContextManager
        agentId={agent.id}
        isPro={subscription?.plan === "pro"}
        initialSources={sources.map((source) => ({
          id: source.id,
          filename: source.filename,
          mimeType: source.mimeType,
          sizeBytes: source.sizeBytes,
          chunkCount: source.chunkCount,
          createdAt: source.createdAt.toISOString(),
        }))}
        initialLimits={{
          maxBytes: MAX_CONTEXT_FILE_BYTES,
          used,
          limit,
          remaining: limit === null ? null : Math.max(limit - used, 0),
          allowedMimeTypes: listAllowedMimeTypes(),
        }}
      />
    </div>
  );
}

export default function AgentContextPage({ params }: ContextPageProps) {
  return (
    <Suspense fallback={<ContextFallback />}>
      <ContextContent params={params} />
    </Suspense>
  );
}
