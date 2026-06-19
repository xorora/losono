import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { auth } from "@/auth";
import { getAppUrl } from "@/lib/app-url";
import { getSubscriptionByUserId } from "@/lib/billing/subscriptions";
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
