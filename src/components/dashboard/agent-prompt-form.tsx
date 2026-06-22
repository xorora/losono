"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PromptPreview } from "@/components/chat/prompt-preview";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const agentPromptSchema = z.object({
  userPrompt: z.string(),
});

type AgentPromptFormValues = z.infer<typeof agentPromptSchema>;

type AgentPromptFormProps = {
  agentId: string;
  initialUserPrompt: string;
};

export function AgentPromptForm({
  agentId,
  initialUserPrompt,
}: AgentPromptFormProps) {
  const router = useRouter();
  const form = useForm<AgentPromptFormValues>({
    resolver: zodResolver(agentPromptSchema),
    defaultValues: { userPrompt: initialUserPrompt },
  });

  const userPrompt = form.watch("userPrompt");

  async function onSubmit(values: AgentPromptFormValues) {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPrompt: values.userPrompt }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "Failed to save");
      }

      toast.success("Prompt saved");
      router.refresh();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Failed to save",
      );
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      noValidate
    >
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">User prompt</h2>
          <p className="text-sm text-muted-foreground">
            Instructions combined server-side with retrieved context. The
            platform master prompt is never shown here.
          </p>
        </div>

        <Field data-invalid={!!form.formState.errors.userPrompt}>
          <FieldLabel htmlFor="user-prompt">Instructions</FieldLabel>
          <Textarea
            id="user-prompt"
            rows={14}
            placeholder="Describe how this agent should behave, what it knows, and any tone or formatting preferences."
            aria-invalid={!!form.formState.errors.userPrompt}
            {...form.register("userPrompt")}
          />
          <FieldDescription>Required before publishing.</FieldDescription>
          <FieldError errors={[form.formState.errors.userPrompt]} />
        </Field>

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="mt-2.5"
        >
          {form.formState.isSubmitting ? "Saving…" : "Save prompt"}
        </Button>
      </section>

      <aside className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-4 space-y-1">
          <h2 className="font-medium">Prompt preview</h2>
          <p className="text-sm text-muted-foreground">
            Live preview of what the agent sees. Test retrieval in the
            playground.
          </p>
        </div>
        <PromptPreview userPrompt={userPrompt} context={[]} />
      </aside>
    </form>
  );
}
