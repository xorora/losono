import { Suspense } from "react";
import { auth } from "@/auth";
import { AgentList } from "@/components/dashboard/agent-list";
import { CreateAgentDialog } from "@/components/dashboard/create-agent-dialog";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { canCreateAgent, getBilledSeatCount } from "@/lib/billing/agent-limits";
import { getSubscriptionWithStripeSync } from "@/lib/billing/sync-subscription";
import { listAgentsForUser } from "@/lib/db/queries/agents";
import { getUserDashboardStats } from "@/lib/db/queries/dashboard";

function DashboardFallback() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-muted/40" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="h-96 animate-pulse rounded-xl bg-muted/40 lg:col-span-8" />
        <div className="grid gap-4 lg:col-span-4">
          <div className="h-56 animate-pulse rounded-xl bg-muted/40" />
          <div className="h-56 animate-pulse rounded-xl bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

async function DashboardContent() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const [subscription, agents, stats] = await Promise.all([
    getSubscriptionWithStripeSync(session.user.id, session.user.email),
    listAgentsForUser(session.user.id),
    getUserDashboardStats(session.user.id),
  ]);

  const billedSeats = getBilledSeatCount(subscription);
  const used = agents.length;
  const canCreate = canCreateAgent(subscription, used);
  const isPro = subscription?.plan === "pro";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Usage and agent performance at a glance
          </p>
        </div>
        <CreateAgentDialog
          canCreate={canCreate}
          billedSeats={billedSeats}
          used={used}
          isPro={isPro}
        />
      </div>

      <DashboardCharts
        stats={stats}
        usedSeats={used}
        billedSeats={billedSeats}
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
