import type Stripe from "stripe";
import {
  ensureFreeSubscription,
  getSubscriptionByStripeCustomerId,
  revertToFreePlan,
  syncProSubscription,
  updateSubscriptionByUserId,
} from "@/lib/billing/subscriptions";
import { getStripe } from "@/lib/stripe";

function subscriptionQuantity(subscription: Stripe.Subscription): number {
  const item = subscription.items.data[0];
  return item?.quantity ?? 1;
}

function mapStripeStatus(
  status: Stripe.Subscription.Status,
): "active" | "canceled" | "past_due" {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      return "canceled";
  }
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!userId || !stripeCustomerId || !stripeSubscriptionId) {
    console.warn(
      "[stripe] checkout.session.completed missing required fields",
      {
        userId,
        stripeCustomerId,
        stripeSubscriptionId,
      },
    );
    return;
  }

  await ensureFreeSubscription(userId);

  await getStripe().customers.update(stripeCustomerId, {
    metadata: { userId },
  });

  const stripeSubscription =
    await getStripe().subscriptions.retrieve(stripeSubscriptionId);

  await syncProSubscription({
    userId,
    stripeCustomerId,
    stripeSubscriptionId,
    agentLimit: subscriptionQuantity(stripeSubscription),
    status: "active",
  });
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const existing = await getSubscriptionByStripeCustomerId(stripeCustomerId);
  if (!existing) {
    console.warn("[stripe] subscription.updated for unknown customer", {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
    });
    return;
  }

  const status = mapStripeStatus(subscription.status);

  if (status === "canceled") {
    await revertToFreePlan(existing.userId);
    return;
  }

  await syncProSubscription({
    userId: existing.userId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    agentLimit: subscriptionQuantity(subscription),
    status,
  });
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const existing = await getSubscriptionByStripeCustomerId(stripeCustomerId);
  if (!existing) {
    console.warn("[stripe] subscription.deleted for unknown customer", {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
    });
    return;
  }

  await revertToFreePlan(existing.userId);
}

export async function handleCustomerCreated(
  customer: Stripe.Customer,
): Promise<void> {
  const userId = customer.metadata?.userId;
  if (!userId) {
    return;
  }

  await updateSubscriptionByUserId(userId, {
    stripeCustomerId: customer.id,
  });
}
