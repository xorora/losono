"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type AgentSettingsFormProps = {
  agentId: string;
  initialName: string;
  initialVoiceEnabled: boolean;
  voiceAvailable: boolean;
};

export function AgentSettingsForm({
  agentId,
  initialName,
  initialVoiceEnabled,
  voiceAvailable,
}: AgentSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [voiceEnabled, setVoiceEnabled] = useState(initialVoiceEnabled);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          voiceEnabled,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "Failed to save");
      }

      setSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this agent and all its context, conversations, and API keys? This cannot be undone.",
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete agent");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete agent",
      );
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">Agent details</h2>
          <p className="text-sm text-muted-foreground">
            Name and voice settings for this agent.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={voiceEnabled}
            onChange={(event) => setVoiceEnabled(event.target.checked)}
            disabled={!voiceAvailable}
            className="mt-1 size-4 rounded border-input"
          />
          <span>
            <span className="font-medium">Enable voice</span>
            <span className="mt-1 block text-muted-foreground">
              {voiceAvailable
                ? "Allow voice mode in playground and deploy when configured."
                : "Voice requires a Pro subscription."}
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={loading || deleting}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <section className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="text-lg font-medium text-destructive">Danger zone</h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete this agent, including all uploaded context and
          deployment settings.
        </p>
        <Button
          type="button"
          variant="destructive"
          disabled={loading || deleting}
          onClick={handleDelete}
        >
          {deleting ? "Deleting…" : "Delete agent"}
        </Button>
      </section>
    </form>
  );
}
