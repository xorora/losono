import type WebSocket from "ws";
import {
  createConversation,
  insertMessage,
  recordVoiceUsage,
} from "@/lib/db/queries/conversations";
import type { Agent } from "@/lib/db/schema";
import { env } from "@/lib/env";
import {
  getGeminiLiveWebSocketUrl,
  getVoiceModelName,
} from "@/lib/gemini/voice";
import {
  buildGeminiAudioInput,
  buildGeminiAudioStreamEnd,
  buildGeminiSetupMessage,
  mapGeminiServerMessage,
  parseVoiceClientMessage,
  type VoiceServerMessage,
} from "@/lib/gemini/voice-messages";
import { buildPromptPreview, composeSystemPrompt } from "@/lib/prompts";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";

function sendClient(client: WebSocket, message: VoiceServerMessage) {
  if (client.readyState === client.OPEN) {
    client.send(JSON.stringify(message));
  }
}

function closeBoth(client: WebSocket, gemini: WebSocket) {
  if (
    gemini.readyState === gemini.OPEN ||
    gemini.readyState === gemini.CONNECTING
  ) {
    gemini.close();
  }
  if (client.readyState === client.OPEN) {
    client.close();
  }
}

export async function startVoiceProxySession(input: {
  client: WebSocket;
  agent: Agent;
  agentId: string;
  userId?: string;
  visitorId?: string;
  mode: "playground" | "voice";
  WebSocketImpl: typeof WebSocket;
}): Promise<void> {
  const { client, agent, agentId, userId, visitorId, mode, WebSocketImpl } =
    input;
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    sendClient(client, {
      type: "error",
      message: "Gemini API key is not configured",
      code: "gemini_not_configured",
    });
    client.close(1011, "Gemini not configured");
    return;
  }

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

  let conversationId: string;
  try {
    const conversation = await createConversation({
      agentId,
      userId,
      mode,
      visitorId,
    });
    conversationId = conversation.id;
  } catch (error) {
    console.error("Failed to create voice conversation:", error);
    sendClient(client, {
      type: "error",
      message: "Failed to start voice session",
      code: "conversation_failed",
    });
    client.close(1011, "Conversation failed");
    return;
  }

  const gemini = new WebSocketImpl(getGeminiLiveWebSocketUrl(apiKey));
  let setupComplete = false;
  const sessionStartedAt = Date.now();

  const cleanup = () => {
    const minutes = Math.max(
      1,
      Math.ceil((Date.now() - sessionStartedAt) / 60_000),
    );
    void recordVoiceUsage(agentId, minutes).catch((error) => {
      console.error("Failed to record voice usage:", error);
    });
  };

  gemini.on("open", () => {
    gemini.send(
      JSON.stringify(
        buildGeminiSetupMessage({
          model: getVoiceModelName(),
          systemInstruction,
          temperature: agent.settings.temperature,
          voiceGender: agent.settings.voiceGender,
        }),
      ),
    );
  });

  gemini.on("message", (data) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return;
    }

    const message = parsed as { setupComplete?: unknown };

    if (message.setupComplete) {
      setupComplete = true;
      sendClient(client, {
        type: "ready",
        conversationId,
        preview,
      });
      return;
    }

    for (const outbound of mapGeminiServerMessage(
      parsed as Parameters<typeof mapGeminiServerMessage>[0],
    )) {
      sendClient(client, outbound);

      if (outbound.type === "transcription") {
        void insertMessage({
          conversationId,
          role: outbound.role === "user" ? "user" : "assistant",
          content: outbound.text,
        }).catch((error) => {
          console.error("Failed to persist voice transcription:", error);
        });
      }
    }
  });

  gemini.on("error", (error) => {
    console.error("Gemini Live WebSocket error:", error);
    sendClient(client, {
      type: "error",
      message: "Lost connection to Gemini Live",
      code: "gemini_connection_failed",
    });
    closeBoth(client, gemini);
  });

  gemini.on("close", () => {
    cleanup();
    if (client.readyState === client.OPEN) {
      client.close();
    }
  });

  client.on("message", (data) => {
    if (!setupComplete || gemini.readyState !== gemini.OPEN) {
      return;
    }

    const clientMessage = parseVoiceClientMessage(data.toString());
    if (!clientMessage) {
      return;
    }

    if (clientMessage.type === "audio") {
      gemini.send(JSON.stringify(buildGeminiAudioInput(clientMessage.data)));
      return;
    }

    if (clientMessage.type === "audio_end") {
      gemini.send(JSON.stringify(buildGeminiAudioStreamEnd()));
    }
  });

  client.on("close", () => {
    cleanup();
    if (
      gemini.readyState === gemini.OPEN ||
      gemini.readyState === gemini.CONNECTING
    ) {
      gemini.close();
    }
  });

  client.on("error", (error) => {
    console.error("Client WebSocket error:", error);
    closeBoth(client, gemini);
  });
}
