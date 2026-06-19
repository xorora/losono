"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PromptPreview } from "@/components/chat/prompt-preview";
import { Button } from "@/components/ui/button";

type AgentPromptFormProps = {
  agentId: string;
  initialUserPrompt: string;
};

export function AgentPromptForm({
  agentId,
  initialUserPrompt,
}: AgentPromptFormProps) {
  const router = useRouter();
  const [userPrompt, setUserPrompt] = useState(initialUserPrompt);
  const [loading, setLoading] = useState(false);
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
        body: JSON.stringify({ userPrompt }),
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

  return (
    <form
      onSubmit={handleSave}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">User prompt</h2>
          <p className="text-sm text-muted-foreground">
            Instructions combined server-side with retrieved context. The
            platform master prompt is never shown here.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Instructions</span>
          <textarea
            value={userPrompt}
            onChange={(event) => setUserPrompt(event.target.value)}
            rows={14}
            placeholder="Describe how this agent should behave, what it knows, and any tone or formatting preferences."
            className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <span className="text-xs text-muted-foreground">
            Required before publishing.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save prompt"}
          </Button>
          {saved && (
            <span className="text-sm text-muted-foreground">Saved</span>
          )}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
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
