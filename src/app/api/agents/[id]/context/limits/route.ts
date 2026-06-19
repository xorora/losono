import { auth } from "@/auth";
import { getSubscriptionWithStripeSync } from "@/lib/billing/sync-subscription";
import {
  countContextSources,
  getAgentForUser,
  getContextFileLimit,
} from "@/lib/db/queries/context";
import { MAX_CONTEXT_FILE_BYTES } from "@/lib/rag/constants";
import { listAllowedMimeTypes } from "@/lib/rag/mime";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: agentId } = await params;

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const agent = await getAgentForUser(agentId, userId);
  if (!agent) {
    return Response.json({ error: "agent_not_found" }, { status: 404 });
  }

  const subscription = await getSubscriptionWithStripeSync(
    userId,
    session?.user?.email,
  );
  const used = await countContextSources(agentId);
  const limit = getContextFileLimit(subscription);

  return Response.json({
    maxBytes: MAX_CONTEXT_FILE_BYTES,
    used,
    limit,
    remaining: limit === null ? null : Math.max(limit - used, 0),
    allowedMimeTypes: listAllowedMimeTypes(),
  });
}
