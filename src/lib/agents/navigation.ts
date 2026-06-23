export const agentNavLinks = [
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
    href: (id: string) => `/agents/${id}/forms`,
    label: "Forms",
    segment: "forms",
  },
  {
    href: (id: string) => `/agents/${id}/deploy`,
    label: "Deploy",
    segment: "deploy",
  },
] as const;

export type AgentNavSegment = (typeof agentNavLinks)[number]["segment"];

export function getAgentIdFromPath(pathname: string) {
  const match = pathname.match(/^\/agents\/([^/]+)/);
  return match?.[1] ?? null;
}

export function getAgentSegmentFromPath(pathname: string): AgentNavSegment {
  const match = pathname.match(/^\/agents\/[^/]+\/([^/]+)/);
  const segment = match?.[1];

  if (
    segment === "prompt" ||
    segment === "context" ||
    segment === "playground" ||
    segment === "forms" ||
    segment === "deploy"
  ) {
    return segment;
  }

  return "settings";
}

export function getAgentHref(agentId: string, segment: AgentNavSegment) {
  const link = agentNavLinks.find((item) => item.segment === segment);
  return link ? link.href(agentId) : `/agents/${agentId}`;
}
