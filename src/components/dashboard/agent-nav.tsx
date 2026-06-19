import Link from "next/link";
import { cn } from "@/lib/utils";

const links = [
  { href: (id: string) => `/agents/${id}`, label: "Settings" },
  { href: (id: string) => `/agents/${id}/prompt`, label: "Prompt" },
  { href: (id: string) => `/agents/${id}/context`, label: "Context" },
  { href: (id: string) => `/agents/${id}/playground`, label: "Playground" },
  { href: (id: string) => `/agents/${id}/deploy`, label: "Deploy" },
] as const;

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
        {links.map((link) => {
          const href = link.href(agentId);
          const isActive =
            (current === "settings" && link.label === "Settings") ||
            (current === "prompt" && link.label === "Prompt") ||
            (current === "context" && link.label === "Context") ||
            (current === "playground" && link.label === "Playground") ||
            (current === "deploy" && link.label === "Deploy");

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
