import { syncProSubscription } from "@/lib/billing/subscriptions";
import type { Subscription } from "@/lib/db/schema";
import {
  findActiveSubscriptionForCustomer,
  updateSubscriptionSeatQuantity,
} from "@/lib/stripe";

function subscriptionQuantityFromStripe(
  subscription: Awaited<ReturnType<typeof updateSubscriptionSeatQuantity>>,
): number {
  return subscription.items.data[0]?.quantity ?? 1;
}

export async function updateBilledSeatsForUser({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  quantity,
}: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  quantity: number;
}): Promise<Subscription | null> {
  const sanitizedQuantity = Math.max(Math.floor(quantity), 1);

  const updatedSubscription = await updateSubscriptionSeatQuantity({
    stripeSubscriptionId,
    quantity: sanitizedQuantity,
  });

  return syncProSubscription({
    userId,
    stripeCustomerId,
    stripeSubscriptionId: updatedSubscription.id,
    agentLimit: subscriptionQuantityFromStripe(updatedSubscription),
    status: "active",
  });
}

/** Reuse an existing Stripe subscription instead of starting a second checkout. */
export async function ensureSeatQuantityOnExistingSubscription({
  userId,
  stripeCustomerId,
  quantity,
}: {
  userId: string;
  stripeCustomerId: string;
  quantity: number;
}): Promise<Subscription | null | "none"> {
  const existingSubscription =
    await findActiveSubscriptionForCustomer(stripeCustomerId);

  if (!existingSubscription) {
    return "none";
  }

  return updateBilledSeatsForUser({
    userId,
    stripeCustomerId,
    stripeSubscriptionId: existingSubscription.id,
    quantity,
  });
}
