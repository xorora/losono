/** Client ↔ Losono voice proxy protocol (not Gemini wire format). */

export type VoiceClientMessage =
  | { type: "audio"; data: string }
  | { type: "audio_end" };

export type VoicePromptPreview = {
  userPrompt: string;
  context: Array<{ content: string; similarity: number }>;
};

export type VoiceServerMessage =
  | { type: "ready"; conversationId: string; preview: VoicePromptPreview }
  | { type: "audio"; data: string; mimeType: string }
  | {
      type: "transcription";
      role: "user" | "assistant";
      text: string;
    }
  | { type: "interrupted" }
  | { type: "turn_complete" }
  | { type: "error"; message: string; code?: string };

export function parseVoiceClientMessage(
  raw: string,
): VoiceClientMessage | null {
  try {
    const parsed = JSON.parse(raw) as VoiceClientMessage;
    if (parsed.type === "audio" && typeof parsed.data === "string") {
      return parsed;
    }
    if (parsed.type === "audio_end") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

type GeminiServerMessage = {
  setupComplete?: Record<string, never>;
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
  };
};

export function mapGeminiServerMessage(
  message: GeminiServerMessage,
): VoiceServerMessage[] {
  const out: VoiceServerMessage[] = [];

  if (message.serverContent?.interrupted) {
    out.push({ type: "interrupted" });
  }

  if (message.serverContent?.turnComplete) {
    out.push({ type: "turn_complete" });
  }

  const inputText = message.serverContent?.inputTranscription?.text?.trim();
  if (inputText) {
    out.push({ type: "transcription", role: "user", text: inputText });
  }

  const outputText = message.serverContent?.outputTranscription?.text?.trim();
  if (outputText) {
    out.push({ type: "transcription", role: "assistant", text: outputText });
  }

  for (const part of message.serverContent?.modelTurn?.parts ?? []) {
    const inline = part.inlineData;
    if (
      inline?.data &&
      inline.mimeType &&
      inline.mimeType.startsWith("audio/")
    ) {
      out.push({
        type: "audio",
        data: inline.data,
        mimeType: inline.mimeType,
      });
    }
  }

  return out;
}

export function buildGeminiSetupMessage(input: {
  model: string;
  systemInstruction: string;
  temperature?: number;
}) {
  return {
    setup: {
      model: input.model,
      generationConfig: {
        responseModalities: ["AUDIO"],
        ...(typeof input.temperature === "number"
          ? { temperature: input.temperature }
          : {}),
      },
      systemInstruction: {
        parts: [{ text: input.systemInstruction }],
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };
}

/** Handshake for ephemeral-token sessions (config is locked in the token). */
export function buildGeminiEphemeralSetupMessage() {
  return { setup: {} };
}

type GeminiErrorMessage = {
  error?: {
    message?: string;
    status?: string;
    code?: number;
  };
};

export function extractGeminiErrorMessage(message: unknown): string | null {
  const error = (message as GeminiErrorMessage).error;
  if (!error) {
    return null;
  }

  return error.message ?? error.status ?? "Voice session error";
}

/** Gemini Live WebSocket frames may arrive as string, Blob, or ArrayBuffer in browsers. */
export async function parseWebSocketJsonMessage(
  data: string | ArrayBuffer | Blob,
): Promise<unknown | null> {
  try {
    const text =
      typeof data === "string"
        ? data
        : data instanceof Blob
          ? await data.text()
          : new TextDecoder().decode(data);
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function buildGeminiAudioInput(base64Pcm: string) {
  return {
    realtimeInput: {
      audio: {
        mimeType: "audio/pcm;rate=16000",
        data: base64Pcm,
      },
    },
  };
}

export function buildGeminiAudioStreamEnd() {
  return {
    realtimeInput: {
      audioStreamEnd: true,
    },
  };
}
