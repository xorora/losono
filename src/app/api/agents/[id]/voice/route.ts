import type { NextRequest } from "next/server";
import {
  resolveVoiceDeployedAccess,
  resolveVoicePlaygroundAccess,
} from "@/lib/auth/deploy-access";
import {
  getConversationForAgentUser,
  insertMessage,
} from "@/lib/db/queries/conversations";
import {
  completeVoiceSession,
  createVoiceSession,
} from "@/lib/gemini/voice-session";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ id: string }> };

type VoiceMode = "playground" | "deploy";

function getVoiceMode(request: NextRequest): VoiceMode {
  const mode = request.nextUrl.searchParams.get("mode");
  return mode === "deploy" ? "deploy" : "playground";
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: agentId } = await params;
  const mode = getVoiceMode(request);

  if (mode === "playground") {
    const result = await resolveVoicePlaygroundAccess(agentId);

    if (result instanceof Response) {
      return result;
    }

    if (!result.voiceAllowed) {
      return Response.json(
        {
          voiceAvailable: false,
          reason: result.voiceReason,
          code: "voice_unavailable",
        },
        { status: 403 },
      );
    }

    return Response.json({ voiceAvailable: true, mode: "playground" });
  }

  const result = await resolveVoiceDeployedAccess({
    agentId,
    request,
    apiKeyFromQuery: request.nextUrl.searchParams.get("apiKey"),
    visitorId: request.nextUrl.searchParams.get("visitorId") ?? undefined,
  });

  if (result instanceof Response) {
    return result;
  }

  if (!result.voiceAllowed) {
    return Response.json(
      {
        voiceAvailable: false,
        reason: result.voiceReason,
        code: "voice_unavailable",
      },
      { status: 403 },
    );
  }

  return Response.json({ voiceAvailable: true, mode: "deploy" });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: agentId } = await params;
  const mode = getVoiceMode(request);

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      {
        error: "gemini_not_configured",
        message: "Gemini API key is not configured",
      },
      { status: 503 },
    );
  }

  try {
    if (mode === "playground") {
      const result = await resolveVoicePlaygroundAccess(agentId);

      if (result instanceof Response) {
        return result;
      }

      if (!result.voiceAllowed) {
        return Response.json(
          {
            error: "voice_unavailable",
            reason: result.voiceReason,
          },
          { status: 403 },
        );
      }

      const session = await createVoiceSession({
        agent: result.agent,
        agentId,
        userId: result.userId,
        mode: "playground",
      });

      return Response.json(session);
    }

    const result = await resolveVoiceDeployedAccess({
      agentId,
      request,
      apiKeyFromQuery: request.nextUrl.searchParams.get("apiKey"),
      visitorId: request.nextUrl.searchParams.get("visitorId") ?? undefined,
    });

    if (result instanceof Response) {
      return result;
    }

    if (!result.voiceAllowed) {
      return Response.json(
        {
          error: "voice_unavailable",
          reason: result.voiceReason,
        },
        { status: 403 },
      );
    }

    const session = await createVoiceSession({
      agent: result.agent,
      agentId,
      visitorId: result.visitorId,
      mode: "voice",
    });

    return Response.json(session);
  } catch (error) {
    console.error("Voice session creation failed:", error);
    return Response.json(
      {
        error: "voice_session_failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to start voice session",
      },
      { status: 500 },
    );
  }
}

type VoicePatchBody = {
  action: "transcript" | "complete";
  conversationId: string;
  role?: "user" | "assistant";
  text?: string;
  sessionStartedAt?: number;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: agentId } = await params;
  const mode = getVoiceMode(request);

  let body: VoicePatchBody;
  try {
    body = (await request.json()) as VoicePatchBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.conversationId) {
    return Response.json(
      { error: "conversation_id_required" },
      { status: 400 },
    );
  }

  if (mode === "playground") {
    const access = await resolveVoicePlaygroundAccess(agentId);
    if (access instanceof Response) {
      return access;
    }

    const conversation = await getConversationForAgentUser(
      body.conversationId,
      agentId,
      access.userId,
    );
    if (!conversation) {
      return Response.json(
        { error: "conversation_not_found" },
        { status: 404 },
      );
    }

    if (body.action === "transcript") {
      if (!body.text?.trim() || !body.role) {
        return Response.json({ error: "transcript_required" }, { status: 400 });
      }

      await insertMessage({
        conversationId: body.conversationId,
        role: body.role,
        content: body.text.trim(),
      });

      return Response.json({ ok: true });
    }

    if (body.action === "complete") {
      if (typeof body.sessionStartedAt !== "number") {
        return Response.json(
          { error: "session_started_at_required" },
          { status: 400 },
        );
      }

      await completeVoiceSession({
        agentId,
        sessionStartedAt: body.sessionStartedAt,
      });

      return Response.json({ ok: true });
    }

    return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  const access = await resolveVoiceDeployedAccess({
    agentId,
    request,
    apiKeyFromQuery: request.nextUrl.searchParams.get("apiKey"),
    visitorId: request.nextUrl.searchParams.get("visitorId") ?? undefined,
  });

  if (access instanceof Response) {
    return access;
  }

  if (body.action === "transcript") {
    if (!body.text?.trim() || !body.role) {
      return Response.json({ error: "transcript_required" }, { status: 400 });
    }

    await insertMessage({
      conversationId: body.conversationId,
      role: body.role,
      content: body.text.trim(),
    });

    return Response.json({ ok: true });
  }

  if (body.action === "complete") {
    if (typeof body.sessionStartedAt !== "number") {
      return Response.json(
        { error: "session_started_at_required" },
        { status: 400 },
      );
    }

    await completeVoiceSession({
      agentId,
      sessionStartedAt: body.sessionStartedAt,
    });

    return Response.json({ ok: true });
  }

  return Response.json({ error: "invalid_action" }, { status: 400 });
}
