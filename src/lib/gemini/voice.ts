import { env } from "@/lib/env";

const GEMINI_LIVE_WS_PATH =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

const GEMINI_LIVE_EPHEMERAL_WS_PATH =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

export function getVoiceModelId(): string {
  return env.GEMINI_VOICE_MODEL;
}

export function getVoiceModelName(): string {
  const model = getVoiceModelId();
  return model.startsWith("models/") ? model : `models/${model}`;
}

export function getGeminiLiveWebSocketUrl(apiKey: string): string {
  return `${GEMINI_LIVE_WS_PATH}?key=${encodeURIComponent(apiKey)}`;
}

export function getGeminiLiveEphemeralWebSocketUrl(
  accessToken: string,
): string {
  return `${GEMINI_LIVE_EPHEMERAL_WS_PATH}?access_token=${encodeURIComponent(accessToken)}`;
}
