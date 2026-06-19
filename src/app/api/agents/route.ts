import { auth } from "@/auth";
import { getSubscriptionWithStripeSync } from "@/lib/billing/sync-subscription";
import {
  countAgentsForUser,
  createAgent,
  listAgentsForUser,
} from "@/lib/db/queries/agents";

type CreateAgentBody = {
  name?: string;
  userPrompt?: string;
};

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const agents = await listAgentsForUser(userId);

  return Response.json({
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      slug: agent.slug,
      status: agent.status,
      voiceEnabled: agent.voiceEnabled,
      userPrompt: agent.userPrompt,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      publishedAt: agent.publishedAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CreateAgentBody;
  try {
    body = (await request.json()) as CreateAgentBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "name_required" }, { status: 400 });
  }

  const subscription = await getSubscriptionWithStripeSync(
    userId,
    session?.user?.email,
  );
  const agentLimit = subscription?.agentLimit ?? 1;
  const activeAgents = await countAgentsForUser(userId);

  if (activeAgents >= agentLimit) {
    return Response.json(
      {
        error: "agent_limit_reached",
        limit: agentLimit,
        used: activeAgents,
      },
      { status: 403 },
    );
  }

  try {
    const agent = await createAgent({
      userId,
      name,
      userPrompt: body.userPrompt,
      voiceEnabled: subscription?.voiceEnabled ?? false,
    });

    return Response.json(
      {
        agent: {
          id: agent.id,
          name: agent.name,
          slug: agent.slug,
          status: agent.status,
          voiceEnabled: agent.voiceEnabled,
          userPrompt: agent.userPrompt,
          createdAt: agent.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create agent:", error);
    return Response.json({ error: "create_failed" }, { status: 500 });
  }
}
