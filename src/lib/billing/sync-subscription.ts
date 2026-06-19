import type Stripe from "stripe";
import {
  ensureFreeSubscription,
  getSubscriptionByUserId,
  revertToFreePlan,
  syncProSubscription,
  updateSubscriptionByUserId,
} from "@/lib/billing/subscriptions";
import type { Subscription } from "@/lib/db/schema";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

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

async function findStripeCustomerId(
  userId: string,
  email?: string | null,
  knownCustomerId?: string | null,
): Promise<string | null> {
  if (knownCustomerId) {
    return knownCustomerId;
  }

  const stripe = getStripe();

  const byMetadata = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });
  if (byMetadata.data[0]) {
    return byMetadata.data[0].id;
  }

  if (!email) {
    return null;
  }

  const byEmail = await stripe.customers.list({ email, limit: 5 });
  const exactMatch = byEmail.data.find(
    (customer) => customer.metadata?.userId === userId,
  );
  if (exactMatch) {
    return exactMatch.id;
  }

  return byEmail.data[0]?.id ?? null;
}

function pickActiveStripeSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  return (
    subscriptions.find((subscription) =>
      ["active", "trialing", "past_due", "unpaid"].includes(
        subscription.status,
      ),
    ) ?? null
  );
}

/** Pull the latest subscription state from Stripe and mirror it in the database. */
export async function syncSubscriptionFromStripe(
  userId: string,
  email?: string | null,
): Promise<Subscription> {
  await ensureFreeSubscription(userId);
  const local = await getSubscriptionByUserId(userId);
  if (!local) {
    throw new Error("subscription row missing after ensureFreeSubscription");
  }

  if (!isStripeConfigured()) {
    return local;
  }

  const stripe = getStripe();
  const stripeCustomerId = await findStripeCustomerId(
    userId,
    email,
    local.stripeCustomerId,
  );

  if (!stripeCustomerId) {
    return local;
  }

  const { data: stripeSubscriptions } = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 10,
  });

  const stripeSubscription = pickActiveStripeSubscription(stripeSubscriptions);

  if (!stripeSubscription) {
    if (local.plan === "pro") {
      const reverted = await revertToFreePlan(userId);
      return reverted ?? local;
    }

    if (local.stripeCustomerId !== stripeCustomerId) {
      const updated = await updateSubscriptionByUserId(userId, {
        stripeCustomerId,
      });
      return updated ?? local;
    }

    return local;
  }

  const synced = await syncProSubscription({
    userId,
    stripeCustomerId,
    stripeSubscriptionId: stripeSubscription.id,
    agentLimit: subscriptionQuantity(stripeSubscription),
    status: mapStripeStatus(stripeSubscription.status),
  });

  return synced ?? local;
}

function hasCompleteProRecord(subscription: Subscription | null): boolean {
  return (
    subscription?.plan === "pro" &&
    Boolean(subscription.stripeCustomerId) &&
    Boolean(subscription.stripeSubscriptionId)
  );
}

/** Read subscription from the database, syncing from Stripe when the local record looks stale. */
export async function getSubscriptionWithStripeSync(
  userId: string,
  email?: string | null,
): Promise<Subscription | null> {
  const subscription = await getSubscriptionByUserId(userId);

  if (!email || !isStripeConfigured() || hasCompleteProRecord(subscription)) {
    return subscription;
  }

  try {
    return await syncSubscriptionFromStripe(userId, email);
  } catch (error) {
    console.error("[billing] stripe sync failed", { userId, error });
    return subscription;
  }
}
