import { and, count, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  agents,
  contextSources,
  conversations,
  usageEvents,
} from "@/lib/db/schema";

export type DashboardDailyActivity = {
  date: string;
  chatMessages: number;
  voiceMinutes: number;
  conversations: number;
};

export type DashboardAgentActivity = {
  agentId: string;
  agentName: string;
  chatMessages: number;
  voiceMinutes: number;
  conversations: number;
};

export type DashboardStats = {
  totals: {
    chatMessages: number;
    voiceMinutes: number;
    conversations: number;
    contextFiles: number;
  };
  dailyActivity: DashboardDailyActivity[];
  agentActivity: DashboardAgentActivity[];
  agentStatus: Array<{ status: string; count: number }>;
  voiceEnabledAgents: number;
};

function buildDailySeries(
  days: number,
  usageByDate: Map<string, { chatMessages: number; voiceMinutes: number }>,
  conversationsByDate: Map<string, number>,
): DashboardDailyActivity[] {
  const series: DashboardDailyActivity[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const usage = usageByDate.get(key);

    series.push({
      date: key,
      chatMessages: usage?.chatMessages ?? 0,
      voiceMinutes: usage?.voiceMinutes ?? 0,
      conversations: conversationsByDate.get(key) ?? 0,
    });
  }

  return series;
}

export async function getUserDashboardStats(
  userId: string,
): Promise<DashboardStats> {
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const userAgents = await db
    .select({ id: agents.id, name: agents.name, status: agents.status })
    .from(agents)
    .where(eq(agents.userId, userId));

  const agentIds = userAgents.map((agent) => agent.id);

  if (agentIds.length === 0) {
    return {
      totals: {
        chatMessages: 0,
        voiceMinutes: 0,
        conversations: 0,
        contextFiles: 0,
      },
      dailyActivity: buildDailySeries(30, new Map(), new Map()),
      agentActivity: [],
      agentStatus: [],
      voiceEnabledAgents: 0,
    };
  }

  const [usageTotals] = await db
    .select({
      chatMessages: sum(
        sql`CASE WHEN ${usageEvents.eventType} = 'chat_message' THEN ${usageEvents.quantity} ELSE 0 END`,
      ),
      voiceMinutes: sum(
        sql`CASE WHEN ${usageEvents.eventType} = 'voice_minute' THEN ${usageEvents.quantity} ELSE 0 END`,
      ),
    })
    .from(usageEvents)
    .where(inArray(usageEvents.agentId, agentIds));

  const [conversationTotals] = await db
    .select({ count: count() })
    .from(conversations)
    .where(
      and(
        inArray(conversations.agentId, agentIds),
        sql`${conversations.mode} != 'playground'`,
      ),
    );

  const [contextTotals] = await db
    .select({ count: count() })
    .from(contextSources)
    .where(inArray(contextSources.agentId, agentIds));

  const dailyUsageRows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${usageEvents.createdAt}), 'YYYY-MM-DD')`,
      chatMessages: sum(
        sql`CASE WHEN ${usageEvents.eventType} = 'chat_message' THEN ${usageEvents.quantity} ELSE 0 END`,
      ),
      voiceMinutes: sum(
        sql`CASE WHEN ${usageEvents.eventType} = 'voice_minute' THEN ${usageEvents.quantity} ELSE 0 END`,
      ),
    })
    .from(usageEvents)
    .where(
      and(
        inArray(usageEvents.agentId, agentIds),
        gte(usageEvents.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(sql`date_trunc('day', ${usageEvents.createdAt})`);

  const dailyConversationRows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${conversations.createdAt}), 'YYYY-MM-DD')`,
      count: count(),
    })
    .from(conversations)
    .where(
      and(
        inArray(conversations.agentId, agentIds),
        gte(conversations.createdAt, thirtyDaysAgo),
        sql`${conversations.mode} != 'playground'`,
      ),
    )
    .groupBy(sql`date_trunc('day', ${conversations.createdAt})`);

  const agentUsageRows = await db
    .select({
      agentId: agents.id,
      agentName: agents.name,
      chatMessages: sum(
        sql`CASE WHEN ${usageEvents.eventType} = 'chat_message' THEN ${usageEvents.quantity} ELSE 0 END`,
      ),
      voiceMinutes: sum(
        sql`CASE WHEN ${usageEvents.eventType} = 'voice_minute' THEN ${usageEvents.quantity} ELSE 0 END`,
      ),
    })
    .from(agents)
    .leftJoin(usageEvents, eq(usageEvents.agentId, agents.id))
    .where(eq(agents.userId, userId))
    .groupBy(agents.id, agents.name);

  const agentConversationRows = await db
    .select({
      agentId: conversations.agentId,
      count: count(),
    })
    .from(conversations)
    .where(
      and(
        inArray(conversations.agentId, agentIds),
        sql`${conversations.mode} != 'playground'`,
      ),
    )
    .groupBy(conversations.agentId);

  const conversationsByAgent = new Map(
    agentConversationRows.map((row) => [row.agentId, Number(row.count)]),
  );

  const usageByDate = new Map(
    dailyUsageRows.map((row) => [
      row.date,
      {
        chatMessages: Number(row.chatMessages ?? 0),
        voiceMinutes: Number(row.voiceMinutes ?? 0),
      },
    ]),
  );

  const conversationsByDate = new Map(
    dailyConversationRows.map((row) => [row.date, Number(row.count)]),
  );

  const statusCounts = new Map<string, number>();
  let voiceEnabledAgents = 0;

  for (const agent of userAgents) {
    statusCounts.set(agent.status, (statusCounts.get(agent.status) ?? 0) + 1);
  }

  const voiceRows = await db
    .select({ count: count() })
    .from(agents)
    .where(and(eq(agents.userId, userId), eq(agents.voiceEnabled, true)));
  voiceEnabledAgents = Number(voiceRows[0]?.count ?? 0);

  return {
    totals: {
      chatMessages: Number(usageTotals?.chatMessages ?? 0),
      voiceMinutes: Number(usageTotals?.voiceMinutes ?? 0),
      conversations: Number(conversationTotals?.count ?? 0),
      contextFiles: Number(contextTotals?.count ?? 0),
    },
    dailyActivity: buildDailySeries(30, usageByDate, conversationsByDate),
    agentActivity: agentUsageRows
      .map((row) => ({
        agentId: row.agentId,
        agentName: row.agentName,
        chatMessages: Number(row.chatMessages ?? 0),
        voiceMinutes: Number(row.voiceMinutes ?? 0),
        conversations: conversationsByAgent.get(row.agentId) ?? 0,
      }))
      .sort((left, right) => right.chatMessages - left.chatMessages),
    agentStatus: Array.from(statusCounts.entries()).map(
      ([status, statusCount]) => ({
        status,
        count: statusCount,
      }),
    ),
    voiceEnabledAgents,
  };
}
