"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VoiceGender } from "@/lib/gemini/voice-config";

const agentSettingsSchema = z.object({
  name: z.string().trim().min(1, "Agent name is required"),
  voiceEnabled: z.boolean(),
  voiceGender: z.enum(["male", "female"]),
});

type AgentSettingsFormValues = z.infer<typeof agentSettingsSchema>;

type AgentSettingsFormProps = {
  agentId: string;
  initialName: string;
  initialVoiceEnabled: boolean;
  initialVoiceGender: VoiceGender;
  voiceAvailable: boolean;
};

export function AgentSettingsForm({
  agentId,
  initialName,
  initialVoiceEnabled,
  initialVoiceGender,
  voiceAvailable,
}: AgentSettingsFormProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: {
      name: initialName,
      voiceEnabled: initialVoiceEnabled,
      voiceGender: initialVoiceGender,
    },
  });

  async function onSubmit(values: AgentSettingsFormValues) {
    try {
      const [agentResponse, settingsResponse] = await Promise.all([
        fetch(`/api/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            voiceEnabled: values.voiceEnabled,
          }),
        }),
        fetch(`/api/agents/${agentId}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings: {
              voiceGender: values.voiceGender,
            },
          }),
        }),
      ]);

      const agentData = (await agentResponse.json()) as {
        error?: string;
        message?: string;
      };
      const settingsData = (await settingsResponse.json()) as {
        error?: string;
        message?: string;
      };

      if (!agentResponse.ok) {
        throw new Error(
          agentData.message ?? agentData.error ?? "Failed to save agent",
        );
      }

      if (!settingsResponse.ok) {
        throw new Error(
          settingsData.error ?? settingsData.message ?? "Failed to save voice",
        );
      }

      toast.success("Settings saved");
      router.refresh();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Failed to save",
      );
    }
  }

  async function handleDelete() {
    setDeleting(true);

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete agent");
      }

      toast.success("Agent deleted");
      router.push("/dashboard");
      router.refresh();
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete agent",
      );
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">Agent details</h2>
          <p className="text-sm text-muted-foreground">
            Name and voice settings for this agent.
          </p>
        </div>

        <FieldGroup>
          <Field data-invalid={!!form.formState.errors.name}>
            <FieldLabel htmlFor="agent-name">Name</FieldLabel>
            <Input
              id="agent-name"
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>

          <Field orientation="horizontal">
            <input
              id="voice-enabled"
              type="checkbox"
              disabled={!voiceAvailable}
              className="mt-1 size-4 rounded border-input"
              {...form.register("voiceEnabled")}
            />
            <FieldContent>
              <FieldLabel htmlFor="voice-enabled">Enable voice</FieldLabel>
              <FieldDescription>
                {voiceAvailable
                  ? "Allow voice mode in playground and deploy when configured."
                  : "Voice requires a Pro subscription."}
              </FieldDescription>
            </FieldContent>
          </Field>

          {voiceAvailable ? (
            <Field data-invalid={!!form.formState.errors.voiceGender}>
              <FieldLabel htmlFor="voice-gender">Voice gender</FieldLabel>
              <Controller
                control={form.control}
                name="voiceGender"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="voice-gender" className="w-full">
                      <SelectValue placeholder="Select voice gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>
                Choose how the agent sounds in voice mode.
              </FieldDescription>
              <FieldError errors={[form.formState.errors.voiceGender]} />
            </Field>
          ) : null}
        </FieldGroup>
      </section>

      <Button type="submit" disabled={form.formState.isSubmitting || deleting}>
        {form.formState.isSubmitting ? "Saving…" : "Save changes"}
      </Button>

      <section className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="text-lg font-medium text-destructive">Danger zone</h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete this agent, including all uploaded context and
          deployment settings.
        </p>
        <Button
          type="button"
          variant="destructive"
          disabled={form.formState.isSubmitting || deleting}
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete agent
        </Button>
      </section>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete agent?"
        description="This will permanently delete this agent and all its context, conversations, and API keys. This cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete agent"}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </form>
  );
}
