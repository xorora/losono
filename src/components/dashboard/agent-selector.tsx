"use client";

import { Bot } from "lucide-react";
import Link from "next/link";
import { useAgentSelection } from "@/components/dashboard/agent-selection-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AgentSelectorProps = {
  totalAgents: number;
};

export function AgentSelector({ totalAgents }: AgentSelectorProps) {
  const { agents, selectedAgent, selectedAgentId, selectAgent } =
    useAgentSelection();

  const countLabel = totalAgents === 1 ? "1 agent" : `${totalAgents} agents`;

  if (agents.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Bot className="size-4 shrink-0" />
        <span>No agents</span>
        <Button asChild variant="link" size="sm" className="h-auto px-0">
          <Link href="/dashboard">Create one</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedAgentId ?? undefined} onValueChange={selectAgent}>
        <SelectTrigger size="sm" className="max-w-[220px]">
          <Bot className="size-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Select agent">
            {selectedAgent?.name ?? "Select agent"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="hidden text-sm text-muted-foreground sm:inline">
        {countLabel}
      </span>
    </div>
  );
}
