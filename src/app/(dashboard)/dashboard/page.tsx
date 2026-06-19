import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AgentList } from "@/components/dashboard/agent-list";
import { CreateAgentForm } from "@/components/dashboard/create-agent-form";
import { Button } from "@/components/ui/button";
import { getSubscriptionWithStripeSync } from "@/lib/billing/sync-subscription";
import { listAgentsForUser } from "@/lib/db/queries/agents";

function DashboardFallback() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="h-48 animate-pulse rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}

async function DashboardContent() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const [subscription, agents] = await Promise.all([
    getSubscriptionWithStripeSync(session.user.id, session.user.email),
    listAgentsForUser(session.user.id),
  ]);

  const agentLimit = subscription?.agentLimit ?? 1;
  const used = agents.length;
  const canCreate = used < agentLimit;
  const isPro = subscription?.plan === "pro";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Signed in as{" "}
          {session.user.email ?? session.user.name ?? session.user.id}
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Subscription</h2>
        {subscription ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium capitalize">{subscription.plan}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{subscription.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Agent seats</dt>
              <dd className="font-medium">
                {used} / {agentLimit} used
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Voice</dt>
              <dd className="font-medium">
                {subscription.voiceEnabled ? "Enabled" : "Chat only"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No subscription record found yet.
          </p>
        )}
        <div className="mt-6">
          <Button asChild variant="secondary">
            <Link href="/billing">Manage billing</Link>
          </Button>
        </div>
      </section>

      <CreateAgentForm
        canCreate={canCreate}
        limit={agentLimit}
        used={used}
        isPro={isPro}
      />

      <AgentList agents={agents} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}
