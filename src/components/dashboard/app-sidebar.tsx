"use client";

import {
  FileText,
  FlaskConical,
  LayoutDashboard,
  Rocket,
  Settings,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { useAgentSelection } from "@/components/dashboard/agent-selection-provider";
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
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  agentNavLinks,
  getAgentSegmentFromPath,
} from "@/lib/agents/navigation";

type SidebarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type AppSidebarProps = {
  user?: SidebarUser;
  logout?: ReactNode;
};

const agentLinkIcons = {
  settings: Settings,
  prompt: FileText,
  context: Upload,
  playground: FlaskConical,
  deploy: Rocket,
} as const;

export function AppSidebar({ user, logout }: AppSidebarProps) {
  const pathname = usePathname();
  const { selectedAgentId } = useAgentSelection();
  const activeSegment = getAgentSegmentFromPath(pathname);
  const hasAgent = Boolean(selectedAgentId);

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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Agent</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agentNavLinks.map((link) => {
                const Icon = agentLinkIcons[link.segment];
                const href = selectedAgentId
                  ? link.href(selectedAgentId)
                  : "/dashboard";
                const isActive =
                  hasAgent &&
                  pathname.startsWith("/agents/") &&
                  activeSegment === link.segment;

                return (
                  <SidebarMenuItem key={link.segment}>
                    <SidebarMenuButton
                      asChild={hasAgent}
                      isActive={isActive}
                      tooltip={link.label}
                      disabled={!hasAgent}
                    >
                      {hasAgent ? (
                        <Link href={href}>
                          <Icon />
                          <span>{link.label}</span>
                        </Link>
                      ) : (
                        <>
                          <Icon />
                          <span>{link.label}</span>
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
