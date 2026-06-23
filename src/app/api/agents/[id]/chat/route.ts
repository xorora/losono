import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import {
  resolveDeployedAccess,
  resolvePlaygroundAccess,
} from "@/lib/auth/deploy-access";
import { assertPreChatComplete } from "@/lib/auth/pre-chat-access";
import { getMessageText } from "@/lib/chat/message-text";
import {
  getOrCreateDeployedConversation,
  getOrCreatePlaygroundConversation,
  insertMessage,
  recordChatUsage,
} from "@/lib/db/queries/conversations";
import type { Agent, Conversation } from "@/lib/db/schema";
import { getChatModel } from "@/lib/gemini/chat";
import { buildPromptPreview, composeSystemPrompt } from "@/lib/prompts";
import {
  type RetrievedChunk,
  retrieveRelevantChunks,
} from "@/lib/rag/retrieve";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ id: string }> };

type LosonoChatData = {
  retrievedContext: {
    preview: ReturnType<typeof buildPromptPreview>;
  };
};

type LosonoUIMessage = UIMessage<unknown, LosonoChatData>;

type ChatRequestBody = {
  messages: LosonoUIMessage[];
  conversationId?: string;
  mode?: "playground" | "chat";
  visitorId?: string;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { id: agentId } = await params;

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const { messages, conversationId, mode = "playground", visitorId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages_required" }, { status: 400 });
  }

  if (mode !== "playground" && mode !== "chat") {
    return Response.json({ error: "invalid_mode" }, { status: 400 });
  }

  let agent: Agent;
  let playgroundUserId: string | undefined;

  if (mode === "playground") {
    const access = await resolvePlaygroundAccess(agentId);
    if (access instanceof Response) {
      return access;
    }
    agent = access.agent;
    playgroundUserId = access.userId;
  } else {
    const access = await resolveDeployedAccess({
      agentId,
      request,
      visitorId,
    });
    if (access instanceof Response) {
      return access;
    }
    agent = access.agent;
  }

  let visitorResponses: Record<string, string> | undefined;

  if (mode === "chat") {
    const preChatResult = await assertPreChatComplete({ agent, visitorId });
    if (preChatResult instanceof Response) {
      return preChatResult;
    }
    if (preChatResult) {
      visitorResponses = preChatResult.responses;
    }
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const userText = getMessageText(lastUserMessage).trim();

  if (!userText) {
    return Response.json({ error: "user_message_required" }, { status: 400 });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "gemini_not_configured" }, { status: 503 });
  }

  let conversation: Conversation;
  try {
    if (mode === "playground" && playgroundUserId) {
      conversation = await getOrCreatePlaygroundConversation(
        agentId,
        playgroundUserId,
        conversationId,
      );
    } else {
      conversation = await getOrCreateDeployedConversation({
        agentId,
        mode: "chat",
        conversationId,
        visitorId,
      });
    }
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return Response.json({ error: "conversation_failed" }, { status: 500 });
  }

  let retrievedChunks: RetrievedChunk[];
  try {
    retrievedChunks = await retrieveRelevantChunks(agentId, userText);
  } catch (error) {
    console.error("RAG retrieval failed:", error);
    return Response.json({ error: "retrieval_failed" }, { status: 500 });
  }

  const system = composeSystemPrompt({
    agent,
    chunks: retrievedChunks,
    mode: "chat",
    visitorResponses,
  });

  const preview = buildPromptPreview({
    userPrompt: agent.userPrompt,
    chunks: retrievedChunks,
  });

  try {
    await insertMessage({
      conversationId: conversation.id,
      role: "user",
      content: userText,
    });
  } catch (error) {
    console.error("Failed to persist user message:", error);
    return Response.json({ error: "message_persist_failed" }, { status: 500 });
  }

  const temperature = agent.settings.temperature;

  const stream = createUIMessageStream<LosonoUIMessage>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      if (mode === "playground") {
        writer.write({
          type: "data-retrievedContext",
          data: { preview },
          transient: true,
        });
      }

      const result = streamText({
        model: getChatModel(),
        system,
        messages: await convertToModelMessages(messages),
        ...(typeof temperature === "number" ? { temperature } : {}),
      });

      writer.merge(result.toUIMessageStream());
    },
    onFinish: async ({ responseMessage }) => {
      const assistantText = getMessageText(responseMessage).trim();
      if (!assistantText) {
        return;
      }

      try {
        await insertMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: assistantText,
        });
        await recordChatUsage(agentId);
      } catch (error) {
        console.error("Failed to persist assistant message:", error);
      }
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "X-Conversation-Id": conversation.id,
    },
  });
}
