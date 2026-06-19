"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const agentSectionLabels: Record<string, string> = {
  settings: "Settings",
  prompt: "Prompt",
  context: "Context",
  playground: "Playground",
  deploy: "Deploy",
};

function getBreadcrumbs(pathname: string) {
  if (pathname === "/dashboard") {
    return [{ label: "Dashboard", href: null }];
  }

  if (pathname === "/billing") {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Billing", href: null },
    ];
  }

  const agentMatch = pathname.match(/^\/agents\/([^/]+)(?:\/(.+))?$/);
  if (agentMatch) {
    const [, agentId, section] = agentMatch;
    const sectionKey = section ?? "settings";
    const sectionLabel =
      agentSectionLabels[sectionKey] ?? agentSectionLabels.settings;

    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Agent", href: `/agents/${agentId}` },
      { label: sectionLabel, href: null },
    ];
  }

  return [{ label: "Dashboard", href: "/dashboard" }];
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);

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
