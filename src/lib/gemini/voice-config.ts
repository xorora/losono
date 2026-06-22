export type VoiceGender = "male" | "female";

export const DEFAULT_VOICE_GENDER: VoiceGender = "female";

const VOICE_NAMES: Record<VoiceGender, string> = {
  male: "Puck",
  female: "Kore",
};

export function resolveVoiceGender(gender?: string | null): VoiceGender {
  return gender === "male" ? "male" : "female";
}

export function resolveVoiceName(gender?: string | null): string {
  return VOICE_NAMES[resolveVoiceGender(gender)];
}

export function buildSpeechConfig(gender?: string | null) {
  return {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: resolveVoiceName(gender),
      },
    },
  };
}
