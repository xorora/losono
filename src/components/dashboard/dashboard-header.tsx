"use client";

import { AgentSelector } from "@/components/dashboard/agent-selector";
import { DashboardBreadcrumbs } from "@/components/dashboard/dashboard-breadcrumbs";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

type DashboardHeaderProps = {
  totalAgents: number;
};

export function DashboardHeader({ totalAgents }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <DashboardBreadcrumbs />
      <div className="ml-auto flex items-center gap-3">
        <AgentSelector totalAgents={totalAgents} />
        <Separator orientation="vertical" className="hidden h-4 sm:block" />
        <ModeToggle />
      </div>
    </header>
  );
}
