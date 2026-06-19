"use client";

import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildGeminiAudioInput,
  mapGeminiServerMessage,
} from "@/lib/gemini/voice-messages";
import { cn } from "@/lib/utils";

type AgentVoiceProps = {
  agentId: string;
  agentName: string;
  voiceAvailable: boolean;
  voiceBlockedReason?: string;
  mode?: "playground" | "deploy";
  apiKey?: string;
  visitorId?: string;
};

type VoiceStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "speaking"
  | "error";

type VoiceSessionResponse = {
  conversationId: string;
  wsUrl: string;
};

function int16ToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = (int16[i] ?? 0) / 0x8000;
  }
  return float32;
}

function buildVoiceApiUrl(
  agentId: string,
  mode: "playground" | "deploy",
  apiKey?: string,
  visitorId?: string,
) {
  const params = new URLSearchParams({ mode });
  if (apiKey) {
    params.set("apiKey", apiKey);
  }
  if (visitorId) {
    params.set("visitorId", visitorId);
  }
  return `/api/agents/${agentId}/voice?${params.toString()}`;
}

export function AgentVoice({
  agentId,
  agentName,
  voiceAvailable,
  voiceBlockedReason,
  mode = "playground",
  apiKey,
  visitorId,
}: AgentVoiceProps) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);

  const wsRef = useRef<WebSocket | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackNodeRef = useRef<AudioWorkletNode | null>(null);
  const isActiveRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const voiceApiUrl = buildVoiceApiUrl(agentId, mode, apiKey, visitorId);

  const persistTranscript = useCallback(
    (conversationId: string, role: "user" | "assistant", text: string) => {
      void fetch(voiceApiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transcript",
          conversationId,
          role,
          text,
        }),
      }).catch((persistError) => {
        console.error("Failed to persist voice transcription:", persistError);
      });
    },
    [voiceApiUrl],
  );

  const completeSession = useCallback(() => {
    const conversationId = conversationIdRef.current;
    const sessionStartedAt = sessionStartedAtRef.current;
    conversationIdRef.current = null;
    sessionStartedAtRef.current = null;

    if (!conversationId || sessionStartedAt === null) {
      return;
    }

    void fetch(voiceApiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        conversationId,
        sessionStartedAt,
      }),
    }).catch((completeError) => {
      console.error("Failed to record voice usage:", completeError);
    });
  }, [voiceApiUrl]);

  const teardown = useCallback(async () => {
    isActiveRef.current = false;
    completeSession();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    captureNodeRef.current?.disconnect();
    captureNodeRef.current = null;
    playbackNodeRef.current?.disconnect();
    playbackNodeRef.current = null;

    for (const track of mediaStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    mediaStreamRef.current = null;

    await captureContextRef.current?.close();
    await playbackContextRef.current?.close();
    captureContextRef.current = null;
    playbackContextRef.current = null;

    setStatus("idle");
  }, [completeSession]);

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  async function startSession() {
    if (!voiceAvailable || isActiveRef.current) {
      return;
    }

    setError(null);
    setStatus("connecting");
    isActiveRef.current = true;

    try {
      const sessionResponse = await fetch(voiceApiUrl, { method: "POST" });
      const sessionData = (await sessionResponse.json()) as
        | VoiceSessionResponse
        | { message?: string; reason?: string; error?: string };

      if (!sessionResponse.ok) {
        const message =
          ("reason" in sessionData && sessionData.reason) ||
          ("message" in sessionData && sessionData.message) ||
          "Failed to start voice session";
        throw new Error(message);
      }

      const session = sessionData as VoiceSessionResponse;
      conversationIdRef.current = session.conversationId;
      sessionStartedAtRef.current = Date.now();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const captureContext = new AudioContext();
      captureContextRef.current = captureContext;
      await captureContext.audioWorklet.addModule(
        "/audio-worklets/capture-processor.js",
      );

      const playbackContext = new AudioContext({ sampleRate: 24000 });
      playbackContextRef.current = playbackContext;
      await playbackContext.audioWorklet.addModule(
        "/audio-worklets/playback-processor.js",
      );

      const playbackNode = new AudioWorkletNode(
        playbackContext,
        "playback-processor",
      );
      playbackNode.connect(playbackContext.destination);
      playbackNodeRef.current = playbackNode;

      const ws = new WebSocket(session.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connecting");
      };

      ws.onmessage = (event) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data as string);
        } catch {
          return;
        }

        const geminiMessage = parsed as { setupComplete?: unknown };

        if (geminiMessage.setupComplete) {
          setStatus("listening");

          const source = captureContext.createMediaStreamSource(stream);
          const captureNode = new AudioWorkletNode(
            captureContext,
            "capture-processor",
          );
          captureNode.port.onmessage = (portEvent) => {
            if (ws.readyState !== WebSocket.OPEN) {
              return;
            }
            ws.send(
              JSON.stringify(
                buildGeminiAudioInput(
                  int16ToBase64(portEvent.data as ArrayBuffer),
                ),
              ),
            );
          };
          source.connect(captureNode);
          captureNodeRef.current = captureNode;
          return;
        }

        for (const message of mapGeminiServerMessage(
          parsed as Parameters<typeof mapGeminiServerMessage>[0],
        )) {
          if (message.type === "audio") {
            setStatus("speaking");
            const samples = base64ToFloat32(message.data);
            playbackNode.port.postMessage(samples.buffer, [samples.buffer]);
            continue;
          }

          if (message.type === "transcription") {
            setTranscript((current) => [
              ...current,
              { role: message.role, text: message.text },
            ]);
            persistTranscript(
              session.conversationId,
              message.role,
              message.text,
            );
            if (message.role === "user") {
              setStatus("listening");
            }
            continue;
          }

          if (message.type === "interrupted") {
            setStatus("listening");
            continue;
          }

          if (message.type === "turn_complete") {
            setStatus("listening");
          }
        }
      };

      ws.onerror = () => {
        setError("Voice connection failed");
        setStatus("error");
        void teardown();
      };

      ws.onclose = (event) => {
        if (event.code !== 1000 && !error) {
          setError(event.reason || "Voice session ended");
        }
        void teardown();
      };
    } catch (startError) {
      const message =
        startError instanceof Error
          ? startError.message
          : "Failed to start voice session";
      setError(message);
      setStatus("error");
      await teardown();
    }
  }

  const isBusy = status === "connecting";

  return (
    <section className="flex min-h-[560px] flex-col rounded-2xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-medium">Voice with {agentName}</h2>
        <p className="text-sm text-muted-foreground">
          Real-time audio via the Gemini Live API.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {!voiceAvailable ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-6 text-center">
            <MicOff className="size-8 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {voiceBlockedReason ?? "Voice is not available on your plan"}
              </p>
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro to test voice in the playground.
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/billing">View billing</Link>
            </Button>
          </div>
        ) : transcript.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Start a voice session and speak to test how your agent responds.
          </div>
        ) : (
          <div className="space-y-3">
            {transcript.map((entry, index) => (
              <div
                key={`${entry.role}-${index}-${entry.text.slice(0, 12)}`}
                className={cn(
                  "max-w-[90%] rounded-2xl px-4 py-3 text-sm",
                  entry.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                <p className="mb-1 text-xs font-medium opacity-70">
                  {entry.role === "user" ? "You" : agentName}
                </p>
                <p className="whitespace-pre-wrap">{entry.text}</p>
              </div>
            ))}
          </div>
        )}

        {status === "speaking" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Agent is speaking…
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border p-4">
        <p className="text-sm text-muted-foreground">
          {status === "idle" && voiceAvailable && "Ready to connect"}
          {status === "connecting" && "Connecting…"}
          {status === "ready" && "Connected"}
          {status === "listening" && "Listening — speak naturally"}
          {status === "speaking" && "Speaking"}
          {status === "error" && "Session ended"}
        </p>

        <div className="flex items-center gap-2">
          {status === "idle" ? (
            <Button
              onClick={() => void startSession()}
              disabled={!voiceAvailable || isBusy}
            >
              <Mic />
              Start voice
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => void teardown()}>
              <PhoneOff />
              End session
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
