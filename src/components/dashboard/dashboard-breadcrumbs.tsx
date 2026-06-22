"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAgentSelection } from "@/components/dashboard/agent-selection-provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  agentNavLinks,
  getAgentIdFromPath,
  getAgentSegmentFromPath,
} from "@/lib/agents/navigation";

const agentSectionLabels = Object.fromEntries(
  agentNavLinks.map((link) => [link.segment, link.label]),
) as Record<string, string>;

function getBreadcrumbs(
  pathname: string,
  agentName: string | null,
  agentId: string | null,
) {
  if (pathname === "/dashboard") {
    return [{ label: "Dashboard", href: null }];
  }

  if (pathname === "/billing") {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Billing", href: null },
    ];
  }

  if (pathname === "/profile") {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Profile", href: null },
    ];
  }

  const pathAgentId = getAgentIdFromPath(pathname);
  if (pathAgentId) {
    const sectionKey = getAgentSegmentFromPath(pathname);
    const sectionLabel =
      agentSectionLabels[sectionKey] ?? agentSectionLabels.settings;
    const displayAgentName = agentName ?? "Agent";

    return [
      { label: "Dashboard", href: "/dashboard" },
      {
        label: displayAgentName,
        href: agentId ? `/agents/${agentId}` : `/agents/${pathAgentId}`,
      },
      { label: sectionLabel, href: null },
    ];
  }

  return [{ label: "Dashboard", href: "/dashboard" }];
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const { selectedAgent } = useAgentSelection();
  const crumbs = getBreadcrumbs(
    pathname,
    selectedAgent?.name ?? null,
    selectedAgent?.id ?? null,
  );

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <span key={`${crumb.label}-${index}`} className="contents">
              <BreadcrumbItem>
                {isLast || !crumb.href ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
