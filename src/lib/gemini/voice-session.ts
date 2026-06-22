import {
  createConversation,
  recordVoiceUsage,
} from "@/lib/db/queries/conversations";
import type { Agent } from "@/lib/db/schema";
import { createEphemeralVoiceToken } from "@/lib/gemini/ephemeral-token";
import { getGeminiLiveEphemeralWebSocketUrl } from "@/lib/gemini/voice";
import { buildPromptPreview, composeSystemPrompt } from "@/lib/prompts";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";

export type VoiceSessionConfig = {
  conversationId: string;
  preview: ReturnType<typeof buildPromptPreview>;
  wsUrl: string;
};

export async function createVoiceSession(input: {
  agent: Agent;
  agentId: string;
  userId?: string;
  visitorId?: string;
  mode: "playground" | "voice";
}): Promise<VoiceSessionConfig> {
  const { agent, agentId, userId, visitorId, mode } = input;

  const ragQuery = agent.userPrompt.trim() || agent.name;
  let chunks: Awaited<ReturnType<typeof retrieveRelevantChunks>> = [];

  try {
    chunks = await retrieveRelevantChunks(agentId, ragQuery);
  } catch (error) {
    console.error("Voice RAG retrieval failed:", error);
  }

  const systemInstruction = composeSystemPrompt({
    agent,
    chunks,
    mode: "voice",
  });
  const preview = buildPromptPreview({
    userPrompt: agent.userPrompt,
    chunks,
  });

  const conversation = await createConversation({
    agentId,
    userId,
    mode,
    visitorId,
  });

  const accessToken = await createEphemeralVoiceToken({
    systemInstruction,
    temperature: agent.settings.temperature,
    voiceGender: agent.settings.voiceGender,
  });

  return {
    conversationId: conversation.id,
    preview,
    wsUrl: getGeminiLiveEphemeralWebSocketUrl(accessToken),
  };
}

export async function completeVoiceSession(input: {
  agentId: string;
  sessionStartedAt: number;
}) {
  const minutes = Math.max(
    1,
    Math.ceil((Date.now() - input.sessionStartedAt) / 60_000),
  );
  await recordVoiceUsage(input.agentId, minutes);
}
