import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AgentSelectionProvider } from "@/components/dashboard/agent-selection-provider";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SignOutDropdownItem } from "@/components/dashboard/sign-out-dropdown-item";
import { SidebarInset } from "@/components/ui/sidebar";
import { listAgentsForUser } from "@/lib/db/queries/agents";
import { getUserById } from "@/lib/db/queries/users";

export function DashboardSidebarFallback() {
  return (
    <div
      className="hidden h-svh w-64 shrink-0 border-r border-border bg-sidebar md:block"
      aria-hidden
    >
      <div className="flex h-full flex-col gap-6 p-4">
        <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
          <div className="h-9 animate-pulse rounded-md bg-muted/60" />
          <div className="h-9 animate-pulse rounded-md bg-muted/60" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
          <div className="h-9 animate-pulse rounded-md bg-muted/60" />
          <div className="h-9 animate-pulse rounded-md bg-muted/60" />
          <div className="h-9 animate-pulse rounded-md bg-muted/60" />
        </div>
      </div>
    </div>
  );
}

export function DashboardHeaderFallback() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
      <div className="ml-auto h-8 w-40 animate-pulse rounded-lg bg-muted/60" />
    </header>
  );
}

export function DashboardChromeFallback() {
  return (
    <>
      <DashboardSidebarFallback />
      <SidebarInset className="min-h-svh">
        <DashboardHeaderFallback />
      </SidebarInset>
    </>
  );
}

type DashboardChromeProps = {
  children: ReactNode;
};

export async function DashboardChrome({ children }: DashboardChromeProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [agents, user] = await Promise.all([
    listAgentsForUser(session.user.id),
    getUserById(session.user.id),
  ]);

  const agentSummaries = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
  }));

  return (
    <AgentSelectionProvider agents={agentSummaries}>
      <AppSidebar
        user={{
          name: user?.name ?? session.user.name,
          email: user?.email ?? session.user.email,
          image: user?.image ?? session.user.image,
        }}
        logout={<SignOutDropdownItem />}
      />
      <SidebarInset className="min-h-svh">
        <DashboardHeader totalAgents={agents.length} />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </AgentSelectionProvider>
  );
}
