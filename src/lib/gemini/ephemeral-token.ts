import { GoogleGenAI, Modality } from "@google/genai";
import { env } from "@/lib/env";
import { getVoiceModelId } from "@/lib/gemini/voice";

type CreateEphemeralTokenInput = {
  systemInstruction: string;
  temperature?: number;
};

export async function createEphemeralVoiceToken(
  input: CreateEphemeralTokenInput,
): Promise<string> {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }

  const client = new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: "v1alpha" },
  });

  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime,
      liveConnectConstraints: {
        model: getVoiceModelId(),
        config: {
          sessionResumption: {},
          responseModalities: [Modality.AUDIO],
          systemInstruction: input.systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          ...(typeof input.temperature === "number"
            ? { temperature: input.temperature }
            : {}),
        },
      },
      lockAdditionalFields: ["temperature"],
      httpOptions: { apiVersion: "v1alpha" },
    },
  });

  if (!token.name) {
    throw new Error("Ephemeral token response missing token name");
  }

  return token.name;
}
