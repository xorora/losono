import type { Subscription } from "@/lib/db/schema";

export function isActiveProPlan(
  subscription: Subscription | null | undefined,
): boolean {
  return (
    subscription?.plan === "pro" &&
    (subscription.status === "active" || subscription.status === "past_due")
  );
}

/** Free trial is capped at one agent; Pro users can create unlimited agents. */
export function canCreateAgent(
  subscription: Subscription | null | undefined,
  activeAgentCount: number,
): boolean {
  if (isActiveProPlan(subscription)) {
    return true;
  }

  const limit = subscription?.agentLimit ?? 1;
  return activeAgentCount < limit;
}

/** Seats billed on the Stripe subscription (not a creation cap for Pro). */
export function getBilledSeatCount(
  subscription: Subscription | null | undefined,
): number {
  return subscription?.agentLimit ?? 1;
}
