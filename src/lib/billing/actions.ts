import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { auth } from "@/auth";
import { getAppUrl } from "@/lib/app-url";
import { getSubscriptionByUserId } from "@/lib/billing/subscriptions";
import { ensureSeatQuantityOnExistingSubscription } from "@/lib/billing/update-seats";
import { countAgentsForUser } from "@/lib/db/queries/agents";
import {
  createBillingPortalSession,
  createCheckoutSession,
  isStripeConfigured,
} from "@/lib/stripe";

async function startCheckout(formData: FormData) {
  "use server";

  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId || !email) {
    redirect("/sign-in");
  }

  if (!isStripeConfigured()) {
    redirect("/billing?error=stripe_not_configured");
  }

  const subscription = await getSubscriptionByUserId(userId);
  const activeAgents = await countAgentsForUser(userId);
  const quantity = Math.max(
    Number.parseInt(String(formData.get("quantity") ?? "1"), 10) || 1,
    activeAgents,
    1,
  );

  const appUrl = getAppUrl();

  if (subscription?.stripeCustomerId) {
    try {
      const updated = await ensureSeatQuantityOnExistingSubscription({
        userId,
        stripeCustomerId: subscription.stripeCustomerId,
        quantity,
      });

      if (updated && updated !== "none") {
        redirect("/billing?checkout=success");
      }
    } catch (error) {
      console.error("[billing] checkout seat update failed", error);
      redirect("/billing?error=seat_update_failed");
    }
  }

  if (
    subscription?.plan === "pro" &&
    subscription.stripeCustomerId &&
    subscription.stripeSubscriptionId
  ) {
    const portal = await createBillingPortalSession({
      stripeCustomerId: subscription.stripeCustomerId,
      returnUrl: `${appUrl}/billing`,
    });
    redirect(portal.url);
  }

  let checkout: Stripe.Checkout.Session;
  try {
    checkout = await createCheckoutSession({
      userId,
      email,
      stripeCustomerId: subscription?.stripeCustomerId,
      quantity,
      successUrl: `${appUrl}/billing?checkout=success`,
      cancelUrl: `${appUrl}/billing?checkout=canceled`,
    });
  } catch (error) {
    console.error("[billing] checkout failed", error);
    redirect("/billing?error=checkout_failed");
  }

  if (!checkout.url) {
    redirect("/billing?error=checkout_failed");
  }

  redirect(checkout.url);
}

async function openPortal() {
  "use server";

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  if (!isStripeConfigured()) {
    redirect("/billing?error=stripe_not_configured");
  }

  const subscription = await getSubscriptionByUserId(userId);

  if (!subscription?.stripeCustomerId) {
    redirect("/billing?error=no_customer");
  }

  const appUrl = getAppUrl();
  const portal = await createBillingPortalSession({
    stripeCustomerId: subscription.stripeCustomerId,
    returnUrl: `${appUrl}/billing`,
  });

  redirect(portal.url);
}

export { openPortal, startCheckout };
