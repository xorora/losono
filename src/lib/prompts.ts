import type { Agent } from "@/lib/db/schema";
import { env } from "@/lib/env";
import {
  formatPreChatResponsesForPrompt,
  resolvePreChatForm,
} from "@/lib/pre-chat-form";
import type { RetrievedChunk } from "@/lib/rag/retrieve";

export type PromptMode = "chat" | "voice";

const CHAT_MODE_HINTS = `## Response format (chat)
- Reply in clear, readable markdown when helpful.
- Keep answers concise unless the user asks for detail.
- If context does not contain the answer, say so honestly.`;

const VOICE_MODE_HINTS = `## Response format (voice)
- Use short, conversational sentences suited for spoken delivery.
- Avoid long lists, markdown, and complex formatting.
- If context does not contain the answer, say so honestly.`;

export function composeSystemPrompt(input: {
  agent: Agent;
  chunks: RetrievedChunk[];
  mode: PromptMode;
  visitorResponses?: Record<string, string>;
}): string {
  const parts: string[] = [];

  const master = env.MASTER_SYSTEM_PROMPT.trim();
  if (master) {
    parts.push(master);
  }

  const userPrompt = input.agent.userPrompt.trim();
  if (userPrompt) {
    parts.push(`## Agent instructions\n${userPrompt}`);
  }

  if (input.visitorResponses) {
    const visitorBlock = formatPreChatResponsesForPrompt({
      config: resolvePreChatForm(input.agent.settings.preChatForm),
      responses: input.visitorResponses,
    });
    if (visitorBlock) {
      parts.push(visitorBlock);
    }
  }

  if (input.chunks.length > 0) {
    const contextBlock = input.chunks
      .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
      .join("\n\n");
    parts.push(
      `## Retrieved context\nUse the following context to answer when relevant:\n\n${contextBlock}`,
    );
  }

  parts.push(input.mode === "voice" ? VOICE_MODE_HINTS : CHAT_MODE_HINTS);

  return parts.join("\n\n");
}

export type PromptPreviewChunk = {
  content: string;
  similarity: number;
};

/** Client-safe preview — never includes the master system prompt. */
export function buildPromptPreview(input: {
  userPrompt: string;
  chunks: RetrievedChunk[];
}): {
  userPrompt: string;
  context: PromptPreviewChunk[];
} {
  return {
    userPrompt: input.userPrompt,
    context: input.chunks.map((chunk) => ({
      content: chunk.content,
      similarity: chunk.similarity,
    })),
  };
}
