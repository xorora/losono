import { auth } from "@/auth";
import { getBilledSeatCount } from "@/lib/billing/agent-limits";
import { getSubscriptionByUserId } from "@/lib/billing/subscriptions";
import { updateBilledSeatsForUser } from "@/lib/billing/update-seats";
import { countAgentsForUser } from "@/lib/db/queries/agents";
import { isStripeConfigured } from "@/lib/stripe";

type SeatsBody = {
  quantity?: number;
};

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return Response.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: SeatsBody = {};
  try {
    body = (await request.json()) as SeatsBody;
  } catch {
    body = {};
  }

  if (
    typeof body.quantity !== "number" ||
    !Number.isFinite(body.quantity) ||
    body.quantity < 1
  ) {
    return Response.json({ error: "invalid_quantity" }, { status: 400 });
  }

  const subscription = await getSubscriptionByUserId(userId);

  if (subscription?.plan !== "pro") {
    return Response.json({ error: "pro_required" }, { status: 403 });
  }

  if (!subscription.stripeCustomerId || !subscription.stripeSubscriptionId) {
    return Response.json({ error: "no_stripe_subscription" }, { status: 400 });
  }

  const agentCount = await countAgentsForUser(userId);
  const quantity = Math.floor(body.quantity);

  if (quantity < agentCount) {
    return Response.json(
      {
        error: "quantity_below_agent_count",
        agentCount,
        message: `You have ${agentCount} agents. Reduce agents or choose at least ${agentCount} seats.`,
      },
      { status: 400 },
    );
  }

  const billedSeats = getBilledSeatCount(subscription);
  if (quantity === billedSeats) {
    return Response.json({
      kind: "unchanged",
      quantity: billedSeats,
      agentCount,
    });
  }

  try {
    const updated = await updateBilledSeatsForUser({
      userId,
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      quantity,
    });

    return Response.json({
      kind: "updated",
      quantity: updated?.agentLimit ?? quantity,
      agentCount,
    });
  } catch (error) {
    console.error("[billing] seat update failed", error);
    return Response.json({ error: "seat_update_failed" }, { status: 500 });
  }
}
