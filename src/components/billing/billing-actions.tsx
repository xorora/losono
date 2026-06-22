"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const billingSeatsSchema = z.object({
  quantity: z
    .number({ error: "Seat count is required" })
    .int("Seat count must be a whole number")
    .min(1, "At least one seat is required"),
});

type BillingSeatsValues = z.infer<typeof billingSeatsSchema>;

type BillingActionsProps = {
  stripeReady: boolean;
  isPro: boolean;
  hasStripeSubscription: boolean;
  agentCount: number;
  billedSeats: number;
};

export function BillingActions({
  stripeReady,
  isPro,
  hasStripeSubscription,
  agentCount,
  billedSeats,
}: BillingActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<
    "checkout" | "portal" | "seats" | null
  >(null);

  const minSeats = Math.max(agentCount, 1);

  const form = useForm<BillingSeatsValues>({
    resolver: zodResolver(billingSeatsSchema),
    defaultValues: {
      quantity: Math.max(billedSeats, agentCount, 1),
    },
  });

  async function startCheckout(values: BillingSeatsValues) {
    setLoading("checkout");

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: values.quantity }),
      });

      const data = (await response.json()) as {
        url?: string;
        error?: string;
        kind?: "checkout" | "portal" | "updated";
        quantity?: number;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not start checkout");
      }

      if (data.kind === "updated") {
        toast.success(
          `Seat count updated to ${data.quantity ?? values.quantity}. Prorated charges apply on your existing subscription.`,
        );
        router.refresh();
        setLoading(null);
        return;
      }

      if (!data.url) {
        throw new Error(data.error ?? "Could not start checkout");
      }

      window.location.assign(data.url);
    } catch (checkoutError) {
      toast.error(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start checkout",
      );
      setLoading(null);
    }
  }

  async function updateSeats(values: BillingSeatsValues) {
    setLoading("seats");

    try {
      const response = await fetch("/api/billing/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: values.quantity }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
        kind?: "updated" | "unchanged";
        quantity?: number;
      };

      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "Could not update seats");
      }

      if (data.kind === "unchanged") {
        toast.info("Seat count is already up to date.");
      } else {
        toast.success(
          `Seat count updated to ${data.quantity ?? values.quantity}. Stripe will prorate the change on your next invoice.`,
        );
      }

      router.refresh();
    } catch (seatError) {
      toast.error(
        seatError instanceof Error
          ? seatError.message
          : "Could not update seats",
      );
    } finally {
      setLoading(null);
    }
  }

  async function openPortal() {
    setLoading("portal");

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Could not open billing portal");
      }

      window.location.assign(data.url);
    } catch (portalError) {
      toast.error(
        portalError instanceof Error
          ? portalError.message
          : "Could not open billing portal",
      );
      setLoading(null);
    }
  }

  if (!stripeReady) {
    return (
      <p className="text-sm text-muted-foreground">
        Stripe is not configured yet. Add your Stripe keys and price ID to
        enable checkout.
      </p>
    );
  }

  return (
    <form className="space-y-4" noValidate>
      <Field data-invalid={!!form.formState.errors.quantity}>
        <FieldLabel htmlFor="seat-quantity">
          {isPro ? "Billed agent seats" : "Agent seats"}
        </FieldLabel>
        <Input
          id="seat-quantity"
          type="number"
          min={minSeats}
          aria-invalid={!!form.formState.errors.quantity}
          {...form.register("quantity", {
            valueAsNumber: true,
            min: minSeats,
          })}
          className="w-24"
        />
        <FieldDescription>
          {isPro
            ? `You have ${agentCount} agent${agentCount === 1 ? "" : "s"} and ${billedSeats} billed seat${billedSeats === 1 ? "" : "s"}. Pro includes unlimited agents; add seats to match billing. Mid-cycle changes are prorated on your existing subscription.`
            : agentCount > 1
              ? `You have ${agentCount} agents — choose at least ${agentCount} seats.`
              : "Each seat includes voice, unlimited context files, and deployment."}
        </FieldDescription>
        <FieldError errors={[form.formState.errors.quantity]} />
      </Field>

      <div className="flex flex-wrap gap-3">
        {isPro && hasStripeSubscription ? (
          <Button
            type="button"
            onClick={form.handleSubmit(updateSeats)}
            disabled={loading !== null}
            variant="default"
          >
            {loading === "seats" ? "Updating…" : "Update billed seats"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={form.handleSubmit(startCheckout)}
            disabled={loading !== null}
          >
            {loading === "checkout" ? "Redirecting…" : "Subscribe to Pro"}
          </Button>
        )}

        {isPro && hasStripeSubscription ? (
          <Button
            type="button"
            onClick={openPortal}
            disabled={loading !== null}
            variant="outline"
          >
            {loading === "portal" ? "Opening…" : "Payment & invoices"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
