import { Check } from "lucide-react";
import Link from "next/link";
import {
  SectionDescription,
  SectionEyebrow,
  SectionTitle,
} from "@/components/landing/landing-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free trial",
    price: "$0",
    period: "forever to start",
    description:
      "Perfect for exploring the platform and building your first agent.",
    features: [
      "1 chat-only agent",
      "Up to 3 context files (10 MB each)",
      "Playground testing",
      "Document RAG with pgvector",
      "Custom system prompts",
    ],
    cta: "Start free",
    href: "/sign-in",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "Per seat",
    period: "billed monthly",
    description:
      "Everything you need to ship voice agents and embed them in production.",
    features: [
      "Voice playground & deployed voice",
      "Unlimited context files per agent",
      "Additional agent seats",
      "Embed widget & API keys",
      "Conversation logs & usage tracking",
      "Production publish mode",
    ],
    cta: "Upgrade to Pro",
    href: "/sign-in",
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="border-t border-border/60 bg-muted/20 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Pricing</SectionEyebrow>
          <SectionTitle className="mt-3">
            Start free, scale when you&apos;re ready
          </SectionTitle>
          <SectionDescription className="mx-auto mt-4">
            No credit card required to begin. Upgrade to Pro when you need
            voice, unlimited context, and production deployment.
          </SectionDescription>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-8",
                plan.highlighted
                  ? "border-primary/40 bg-card shadow-xl shadow-primary/10"
                  : "border-border/60 bg-card",
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  Most popular
                </span>
              )}
              <div>
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    &nbsp;{plan.period}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        plan.highlighted
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="mt-8 w-full"
                variant={plan.highlighted ? "default" : "outline"}
                size="lg"
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
