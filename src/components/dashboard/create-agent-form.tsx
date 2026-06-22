"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const createAgentSchema = z.object({
  name: z.string().trim().min(1, "Agent name is required"),
});

type CreateAgentFormValues = z.infer<typeof createAgentSchema>;

type CreateAgentFormProps = {
  canCreate: boolean;
  billedSeats: number;
  used: number;
  isPro: boolean;
  variant?: "section" | "embedded";
  onCreated?: () => void;
};

export function CreateAgentForm({
  canCreate,
  billedSeats,
  used,
  isPro,
  variant = "section",
  onCreated,
}: CreateAgentFormProps) {
  const router = useRouter();
  const form = useForm<CreateAgentFormValues>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: CreateAgentFormValues) {
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name }),
      });

      const data = (await response.json()) as {
        agent?: { id: string };
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        if (data.error === "agent_limit_reached") {
          throw new Error(
            "Free trial allows one agent. Upgrade to Pro to create more.",
          );
        }
        throw new Error(data.message ?? data.error ?? "Failed to create agent");
      }

      if (data.agent?.id) {
        toast.success("Agent created");
        form.reset();
        onCreated?.();
        router.push(`/agents/${data.agent.id}`);
        router.refresh();
      }
    } catch (createError) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Failed to create agent",
      );
    }
  }

  const content = (
    <>
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Create agent</h2>
        <p className="text-sm text-muted-foreground">
          {isPro
            ? `${used} agent${used === 1 ? "" : "s"} · ${billedSeats} billed seat${billedSeats === 1 ? "" : "s"}`
            : `${used} / ${billedSeats} agent seat${billedSeats === 1 ? "" : "s"} used`}
        </p>
      </div>

      {!canCreate && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Free trial includes one agent. Upgrade to Pro for unlimited agents and
          voice.
        </p>
      )}

      {isPro && used >= billedSeats && (
        <p className="mt-4 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          You have more agents than billed seats. Update seats on the billing
          page to stay aligned with your subscription.
        </p>
      )}

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mt-4 flex flex-wrap items-end gap-2"
        noValidate
      >
        <Field
          className="min-w-[220px] flex-1"
          data-invalid={!!form.formState.errors.name}
        >
          <FieldLabel htmlFor="agent-name">Agent name</FieldLabel>
          <Input
            id="agent-name"
            placeholder="Support assistant"
            disabled={!canCreate || form.formState.isSubmitting}
            aria-invalid={!!form.formState.errors.name}
            {...form.register("name")}
          />
          <FieldError errors={[form.formState.errors.name]} />
        </Field>
        <Button
          type="submit"
          disabled={
            !canCreate ||
            form.formState.isSubmitting ||
            !form.watch("name").trim()
          }
        >
          {form.formState.isSubmitting ? "Creating…" : "Create agent"}
        </Button>
      </form>
    </>
  );

  if (variant === "embedded") {
    return <div>{content}</div>;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      {content}
    </section>
  );
}
