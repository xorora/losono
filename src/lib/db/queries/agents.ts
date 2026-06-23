import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  type Agent,
  type AgentSettings,
  type AgentStatus,
  agents,
} from "@/lib/db/schema";

export function slugifyAgentName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "agent";
}

async function createUniqueSlug(name: string): Promise<string> {
  const base = slugifyAgentName(name);
  let slug = base;
  let attempt = 0;

  while (attempt < 100) {
    const [existing] = await getDb()
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.slug, slug))
      .limit(1);

    if (!existing) {
      return slug;
    }

    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function countAgentsForUser(userId: string): Promise<number> {
  const [result] = await getDb()
    .select({ count: count() })
    .from(agents)
    .where(eq(agents.userId, userId));

  return Number(result?.count ?? 0);
}

export async function listAgentsForUser(userId: string): Promise<Agent[]> {
  return getDb()
    .select()
    .from(agents)
    .where(eq(agents.userId, userId))
    .orderBy(desc(agents.updatedAt));
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const [agent] = await getDb()
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  return agent ?? null;
}

export async function getAgentForUser(
  agentId: string,
  userId: string,
): Promise<Agent | null> {
  const [agent] = await getDb()
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)))
    .limit(1);

  return agent ?? null;
}

export async function getPublishedAgentById(
  agentId: string,
): Promise<Agent | null> {
  const [agent] = await getDb()
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.status, "published")))
    .limit(1);

  return agent ?? null;
}

export async function getPublishedAgentBySlug(
  slug: string,
): Promise<Agent | null> {
  const [agent] = await getDb()
    .select()
    .from(agents)
    .where(and(eq(agents.slug, slug), eq(agents.status, "published")))
    .limit(1);

  return agent ?? null;
}

export async function publishAgent(
  agentId: string,
  userId: string,
): Promise<Agent | null> {
  const [agent] = await getDb()
    .update(agents)
    .set({
      status: "published" satisfies AgentStatus,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agents.id, agentId),
        eq(agents.userId, userId),
        sql`length(trim(${agents.userPrompt})) > 0`,
      ),
    )
    .returning();

  return agent ?? null;
}

export async function unpublishAgent(
  agentId: string,
  userId: string,
): Promise<Agent | null> {
  const [agent] = await getDb()
    .update(agents)
    .set({
      status: "draft" satisfies AgentStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)))
    .returning();

  return agent ?? null;
}

export async function updateAgentSettings(
  agentId: string,
  userId: string,
  settings: AgentSettings,
): Promise<Agent | null> {
  const [agent] = await getDb()
    .update(agents)
    .set({
      settings,
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)))
    .returning();

  return agent ?? null;
}

export async function createAgent(input: {
  userId: string;
  name: string;
  userPrompt?: string;
  voiceEnabled?: boolean;
}): Promise<Agent> {
  const slug = await createUniqueSlug(input.name);

  const [agent] = await getDb()
    .insert(agents)
    .values({
      userId: input.userId,
      name: input.name.trim(),
      slug,
      userPrompt: input.userPrompt?.trim() ?? "",
      voiceEnabled: input.voiceEnabled ?? false,
      status: "draft",
    })
    .returning();

  if (!agent) {
    throw new Error("Failed to create agent");
  }

  return agent;
}

export async function updateAgent(
  agentId: string,
  userId: string,
  data: {
    name?: string;
    userPrompt?: string;
    voiceEnabled?: boolean;
  },
): Promise<Agent | null> {
  const updates: {
    name?: string;
    userPrompt?: string;
    voiceEnabled?: boolean;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (typeof data.name === "string") {
    updates.name = data.name.trim();
  }

  if (typeof data.userPrompt === "string") {
    updates.userPrompt = data.userPrompt;
  }

  if (typeof data.voiceEnabled === "boolean") {
    updates.voiceEnabled = data.voiceEnabled;
  }

  const [agent] = await getDb()
    .update(agents)
    .set(updates)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)))
    .returning();

  return agent ?? null;
}

export async function deleteAgent(
  agentId: string,
  userId: string,
): Promise<boolean> {
  const deleted = await getDb()
    .delete(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)))
    .returning({ id: agents.id });

  return deleted.length > 0;
}
