import Stripe from "stripe";
import { env } from "@/lib/env";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PRICE_AGENT_SEAT,
  );
}

async function assertRecurringPrice(priceId: string): Promise<void> {
  const stripe = getStripe();
  const price = await stripe.prices.retrieve(priceId);

  if (price.type !== "recurring") {
    throw new Error(
      "STRIPE_PRICE_AGENT_SEAT must be a recurring subscription price. " +
        "Create one in Stripe Dashboard (Products → your product → Add price → Recurring).",
    );
  }
}

export async function createCheckoutSession({
  userId,
  email,
  stripeCustomerId,
  quantity,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  email: string;
  stripeCustomerId?: string | null;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  if (!env.STRIPE_PRICE_AGENT_SEAT) {
    throw new Error("STRIPE_PRICE_AGENT_SEAT is not configured");
  }

  await assertRecurringPrice(env.STRIPE_PRICE_AGENT_SEAT);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId ?? undefined,
    customer_email: stripeCustomerId ? undefined : email,
    client_reference_id: userId,
    line_items: [
      {
        price: env.STRIPE_PRICE_AGENT_SEAT,
        quantity: Math.max(quantity, 1),
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
  });
}

export async function createBillingPortalSession({
  stripeCustomerId,
  returnUrl,
}: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();

  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
}

export async function findActiveSubscriptionForCustomer(
  stripeCustomerId: string,
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();

  const { data: subscriptions } = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 10,
  });

  return (
    subscriptions.find((subscription) =>
      ["active", "trialing", "past_due", "unpaid"].includes(
        subscription.status,
      ),
    ) ?? null
  );
}

export async function updateSubscriptionSeatQuantity({
  stripeSubscriptionId,
  quantity,
}: {
  stripeSubscriptionId: string;
  quantity: number;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const item = subscription.items.data[0];

  if (!item) {
    throw new Error("subscription_has_no_items");
  }

  return stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: item.id, quantity: Math.max(quantity, 1) }],
    proration_behavior: "create_prorations",
  });
}
