"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getAgentHref,
  getAgentIdFromPath,
  getAgentSegmentFromPath,
} from "@/lib/agents/navigation";

const STORAGE_KEY = "losono-selected-agent-id";

export type AgentSummary = {
  id: string;
  name: string;
};

type AgentSelectionContextValue = {
  agents: AgentSummary[];
  selectedAgent: AgentSummary | null;
  selectedAgentId: string | null;
  selectAgent: (agentId: string) => void;
};

const AgentSelectionContext = createContext<AgentSelectionContextValue | null>(
  null,
);

function readStoredAgentId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEY);
}

function writeStoredAgentId(agentId: string) {
  window.localStorage.setItem(STORAGE_KEY, agentId);
}

function resolveSelectedAgentId(
  agents: AgentSummary[],
  pathname: string,
  storedAgentId: string | null,
) {
  const pathAgentId = getAgentIdFromPath(pathname);

  if (pathAgentId && agents.some((agent) => agent.id === pathAgentId)) {
    return pathAgentId;
  }

  if (storedAgentId && agents.some((agent) => agent.id === storedAgentId)) {
    return storedAgentId;
  }

  return agents[0]?.id ?? null;
}

type AgentSelectionProviderProps = {
  agents: AgentSummary[];
  children: ReactNode;
};

export function AgentSelectionProvider({
  agents,
  children,
}: AgentSelectionProviderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [storedAgentId, setStoredAgentId] = useState<string | null>(null);

  useEffect(() => {
    setStoredAgentId(readStoredAgentId());
  }, []);

  const selectedAgentId = useMemo(
    () => resolveSelectedAgentId(agents, pathname, storedAgentId),
    [agents, pathname, storedAgentId],
  );

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  useEffect(() => {
    if (!selectedAgentId) {
      return;
    }

    writeStoredAgentId(selectedAgentId);
    setStoredAgentId(selectedAgentId);
  }, [selectedAgentId]);

  const selectAgent = useCallback(
    (agentId: string) => {
      if (!agents.some((agent) => agent.id === agentId)) {
        return;
      }

      writeStoredAgentId(agentId);
      setStoredAgentId(agentId);

      const pathAgentId = getAgentIdFromPath(pathname);
      if (!pathAgentId) {
        return;
      }

      const segment = getAgentSegmentFromPath(pathname);
      router.push(getAgentHref(agentId, segment));
    },
    [agents, pathname, router],
  );

  const value = useMemo(
    () => ({
      agents,
      selectedAgent,
      selectedAgentId,
      selectAgent,
    }),
    [agents, selectedAgent, selectedAgentId, selectAgent],
  );

  return (
    <AgentSelectionContext.Provider value={value}>
      {children}
    </AgentSelectionContext.Provider>
  );
}

export function useAgentSelection() {
  const context = useContext(AgentSelectionContext);

  if (!context) {
    throw new Error(
      "useAgentSelection must be used within an AgentSelectionProvider",
    );
  }

  return context;
}
