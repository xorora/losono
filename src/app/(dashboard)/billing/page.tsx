import { Suspense } from "react";
import { auth } from "@/auth";
import { BillingActions } from "@/components/billing/billing-actions";
import { getBilledSeatCount } from "@/lib/billing/agent-limits";
import { getSubscriptionByUserId } from "@/lib/billing/subscriptions";
import { syncSubscriptionFromStripe } from "@/lib/billing/sync-subscription";
import { countAgentsForUser } from "@/lib/db/queries/agents";
import { isStripeConfigured } from "@/lib/stripe";

function BillingFallback() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}

async function BillingContent({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const session = await auth();
  const { checkout, error } = await searchParams;

  if (!session?.user?.id) {
    return null;
  }

  const stripeReady = isStripeConfigured();
  const activeAgents = await countAgentsForUser(session.user.id);

  let subscription = await getSubscriptionByUserId(session.user.id);
  if (stripeReady) {
    try {
      subscription = await syncSubscriptionFromStripe(
        session.user.id,
        session.user.email,
      );
    } catch (syncError) {
      console.error("[billing] stripe sync failed on page load", syncError);
    }
  }
  const isPro = subscription?.plan === "pro";
  const billedSeats = getBilledSeatCount(subscription);
  const hasStripeSubscription = Boolean(
    subscription?.stripeCustomerId && subscription?.stripeSubscriptionId,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Free trial includes one chat-only agent and up to 3 context files. Pro
          unlocks voice, unlimited agents, and per-seat billing.
        </p>
      </div>

      {checkout === "success" && (
        <p className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Subscription updated. Your plan has been synced from Stripe.
        </p>
      )}

      {checkout === "canceled" && (
        <p className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Checkout canceled. No changes were made.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Billing action failed ({error.replace(/_/g, " ")}).
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Current plan</h2>
        {subscription ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium capitalize">{subscription.plan}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{subscription.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {isPro ? "Agents / billed seats" : "Agent seats"}
              </dt>
              <dd className="font-medium">
                {isPro
                  ? `${activeAgents} agents · ${billedSeats} billed seat${billedSeats === 1 ? "" : "s"}`
                  : `${activeAgents} / ${billedSeats} used`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Voice</dt>
              <dd className="font-medium">
                {subscription.voiceEnabled ? "Enabled" : "Chat only"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No subscription found.
          </p>
        )}

        {stripeReady ? (
          <div className="mt-6">
            <BillingActions
              stripeReady={stripeReady}
              isPro={isPro}
              hasStripeSubscription={hasStripeSubscription}
              agentCount={activeAgents}
              billedSeats={billedSeats}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and
            STRIPE_PRICE_AGENT_SEAT to enable checkout.
          </p>
        )}
      </section>

      {!isPro && stripeReady && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium">Pro includes</h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>Voice playground and deployed voice mode</li>
            <li>Unlimited context files per agent</li>
            <li>Unlimited agents with per-seat billing</li>
            <li>Embed widget and API keys for production</li>
          </ul>
        </section>
      )}
    </div>
  );
}

export default function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<BillingFallback />}>
      <BillingContent searchParams={searchParams} />
    </Suspense>
  );
}
