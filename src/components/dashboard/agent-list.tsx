import Link from "next/link";
import type { Agent } from "@/lib/db/schema";

type AgentListProps = {
  agents: Agent[];
};

export function AgentList({ agents }: AgentListProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Your agents</h2>
        <p className="text-sm text-muted-foreground">
          Manage prompts, context, and deployment for each agent.
        </p>
      </div>

      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {agents.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No agents yet. Use Create Agent to get started.
          </li>
        ) : (
          agents.map((agent) => (
            <li key={agent.id}>
              <Link
                href={`/agents/${agent.id}`}
                className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{agent.name}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="capitalize">{agent.status}</span>
                    {agent.voiceEnabled ? " · Voice" : " · Chat only"}
                    {agent.userPrompt.trim()
                      ? " · Prompt set"
                      : " · No prompt yet"}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-primary">Open →</span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
