"use client";

import { Bot, CreditCard, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { SidebarUserMenu } from "@/components/dashboard/sidebar-user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type SidebarAgent = {
  id: string;
  name: string;
};

type SidebarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type AppSidebarProps = {
  agents: SidebarAgent[];
  user?: SidebarUser;
  logout?: ReactNode;
};

const agentLinks = [
  {
    href: (id: string) => `/agents/${id}`,
    label: "Settings",
    segment: "settings",
  },
  {
    href: (id: string) => `/agents/${id}/prompt`,
    label: "Prompt",
    segment: "prompt",
  },
  {
    href: (id: string) => `/agents/${id}/context`,
    label: "Context",
    segment: "context",
  },
  {
    href: (id: string) => `/agents/${id}/playground`,
    label: "Playground",
    segment: "playground",
  },
  {
    href: (id: string) => `/agents/${id}/deploy`,
    label: "Deploy",
    segment: "deploy",
  },
] as const;

function getActiveAgentId(pathname: string) {
  const match = pathname.match(/^\/agents\/([^/]+)/);
  return match?.[1] ?? null;
}

function getAgentSegment(pathname: string) {
  const match = pathname.match(/^\/agents\/[^/]+\/([^/]+)/);
  return match?.[1] ?? "settings";
}

export function AppSidebar({ agents, user, logout }: AppSidebarProps) {
  const pathname = usePathname();
  const activeAgentId = getActiveAgentId(pathname);
  const activeSegment = getAgentSegment(pathname);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <Logo variant="mark" href={null} markClassName="size-8" />
                <span className="truncate font-semibold">Losono</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard"}
                  tooltip="Dashboard"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/billing"}
                  tooltip="Billing"
                >
                  <Link href="/billing">
                    <CreditCard />
                    <span>Billing</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Agents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agents.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <Bot />
                    <span>No agents yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                agents.map((agent) => {
                  const isActiveAgent = activeAgentId === agent.id;

                  return (
                    <SidebarMenuItem key={agent.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActiveAgent}
                        tooltip={agent.name}
                      >
                        <Link href={`/agents/${agent.id}`}>
                          <Bot />
                          <span>{agent.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      {isActiveAgent ? (
                        <SidebarMenuSub>
                          {agentLinks.map((link) => (
                            <SidebarMenuSubItem key={link.segment}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={activeSegment === link.segment}
                              >
                                <Link href={link.href(agent.id)}>
                                  <span>{link.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && logout ? (
          <SidebarUserMenu user={user} logout={logout} />
        ) : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
