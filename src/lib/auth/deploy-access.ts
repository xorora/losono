import { auth } from "@/auth";
import { extractBearerApiKey, verifyApiKey } from "@/lib/api-keys";
import { getSubscriptionWithStripeSync } from "@/lib/billing/sync-subscription";
import { canUseVoiceInPlayground } from "@/lib/billing/voice-access";
import {
  getAgentForUser,
  getPublishedAgentById,
  getPublishedAgentBySlug,
} from "@/lib/db/queries/agents";
import {
  findActiveApiKeyForAgent,
  touchApiKeyLastUsed,
} from "@/lib/db/queries/api-keys";
import type { Agent } from "@/lib/db/schema";

export type PlaygroundAccess = {
  kind: "playground";
  userId: string;
  agent: Agent;
};

export type DeployedAccess = {
  kind: "deployed";
  agent: Agent;
  visitorId?: string;
  apiKeyId?: string;
};

export type ChatVoiceAccess = PlaygroundAccess | DeployedAccess;

function isEmbedReferer(referer: string | null, slug: string): boolean {
  if (!referer) {
    return false;
  }

  try {
    const url = new URL(referer);
    return (
      url.pathname === `/embed/${slug}` ||
      url.pathname.startsWith(`/embed/${slug}/`)
    );
  } catch {
    return false;
  }
}

function isOriginAllowed(agent: Agent, origin: string | null): boolean {
  const allowed = agent.settings.allowedOrigins ?? [];
  if (allowed.length === 0) {
    return true;
  }

  if (!origin) {
    return false;
  }

  try {
    const hostname = new URL(origin).hostname;
    return allowed.some(
      (entry) =>
        entry === origin || entry === hostname || entry === `*.${hostname}`,
    );
  } catch {
    return allowed.includes(origin);
  }
}

export async function resolvePlaygroundAccess(
  agentId: string,
): Promise<PlaygroundAccess | Response> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const agent = await getAgentForUser(agentId, userId);
  if (!agent) {
    return Response.json({ error: "agent_not_found" }, { status: 404 });
  }

  return { kind: "playground", userId, agent };
}

export async function resolveDeployedAccess(input: {
  agentId: string;
  request: Request;
  visitorId?: string;
}): Promise<DeployedAccess | Response> {
  const agent = await getPublishedAgentById(input.agentId);
  if (!agent) {
    return Response.json({ error: "agent_not_published" }, { status: 403 });
  }

  const authorization = input.request.headers.get("authorization");
  const apiKeyRaw = extractBearerApiKey(authorization);

  if (apiKeyRaw) {
    const record = await findActiveApiKeyForAgent(
      agent.id,
      apiKeyRaw,
      verifyApiKey,
    );
    if (!record) {
      return Response.json({ error: "invalid_api_key" }, { status: 401 });
    }

    await touchApiKeyLastUsed(record.id);

    return {
      kind: "deployed",
      agent,
      apiKeyId: record.id,
      visitorId: input.visitorId,
    };
  }

  const referer = input.request.headers.get("referer");
  const origin = input.request.headers.get("origin");

  if (isEmbedReferer(referer, agent.slug)) {
    return {
      kind: "deployed",
      agent,
      visitorId: input.visitorId,
    };
  }

  if (isOriginAllowed(agent, origin)) {
    return {
      kind: "deployed",
      agent,
      visitorId: input.visitorId,
    };
  }

  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export async function resolveDeployedAccessBySlug(input: {
  slug: string;
  request: Request;
  visitorId?: string;
}): Promise<DeployedAccess | Response> {
  const agent = await getPublishedAgentBySlug(input.slug);
  if (!agent) {
    return Response.json({ error: "agent_not_found" }, { status: 404 });
  }

  return resolveDeployedAccess({
    agentId: agent.id,
    request: input.request,
    visitorId: input.visitorId,
  });
}

export async function resolveVoicePlaygroundAccess(
  agentId: string,
): Promise<
  | (PlaygroundAccess & { voiceAllowed: boolean; voiceReason?: string })
  | Response
> {
  const access = await resolvePlaygroundAccess(agentId);
  if (access instanceof Response) {
    return access;
  }

  const subscription = await getSubscriptionWithStripeSync(access.userId);
  const voice = canUseVoiceInPlayground(subscription, access.agent);

  return {
    ...access,
    voiceAllowed: voice.allowed,
    voiceReason: voice.allowed ? undefined : voice.reason,
  };
}

export async function resolveVoiceDeployedAccess(input: {
  agentId: string;
  request: Request;
  apiKeyFromQuery?: string | null;
  visitorId?: string;
}): Promise<
  (DeployedAccess & { voiceAllowed: boolean; voiceReason?: string }) | Response
> {
  const request = input.request;
  let deployedRequest = request;

  if (input.apiKeyFromQuery && !request.headers.get("authorization")) {
    deployedRequest = new Request(request.url, {
      headers: new Headers({
        authorization: `Bearer ${input.apiKeyFromQuery}`,
      }),
    });
  }

  const access = await resolveDeployedAccess({
    agentId: input.agentId,
    request: deployedRequest,
    visitorId: input.visitorId,
  });

  if (access instanceof Response) {
    return access;
  }

  const subscription = await getSubscriptionWithStripeSync(access.agent.userId);
  const voice = canUseVoiceInPlayground(subscription, access.agent);

  return {
    ...access,
    voiceAllowed: voice.allowed,
    voiceReason: voice.allowed ? undefined : voice.reason,
  };
}
