import Link from "next/link";
import { agentNavLinks } from "@/lib/agents/navigation";
import { cn } from "@/lib/utils";

type AgentNavProps = {
  agentId: string;
  agentName: string;
  current: "settings" | "prompt" | "context" | "playground" | "deploy";
};

export function AgentNav({ agentId, agentName, current }: AgentNavProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Agent</p>
        <h1 className="text-3xl font-semibold tracking-tight">{agentName}</h1>
      </div>
      <nav className="flex flex-wrap gap-2">
        {agentNavLinks.map((link) => {
          const href = link.href(agentId);
          const isActive = current === link.segment;

          return (
            <Link
              key={link.label}
              href={href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
