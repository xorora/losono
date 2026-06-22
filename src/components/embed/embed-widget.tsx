"use client";

import { useChat } from "@ai-sdk/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, Mic, Send, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const embedChatSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
});

type EmbedChatValues = z.infer<typeof embedChatSchema>;

type LosonoUIMessage = UIMessage;

type EmbedWidgetProps = {
  agentId: string;
  agentName: string;
  greeting: string;
  primaryColor: string;
  voiceEnabled: boolean;
  defaultOpen?: boolean;
  compact?: boolean;
};

function getVisitorId() {
  const key = "losono_visitor_id";
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

function getMessageText(message: LosonoUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function EmbedWidget({
  agentId,
  agentName,
  greeting,
  primaryColor,
  voiceEnabled,
  defaultOpen = true,
  compact = false,
}: EmbedWidgetProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<"chat" | "voice">("chat");
  const [voiceStatus, setVoiceStatus] = useState<string>("idle");
  const form = useForm<EmbedChatValues>({
    resolver: zodResolver(embedChatSchema),
    defaultValues: { message: "" },
  });
  const message = form.watch("message");
  const conversationIdRef = useRef<string | undefined>(undefined);
  const visitorIdRef = useRef<string>("");

  useEffect(() => {
    visitorIdRef.current = getVisitorId();
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<LosonoUIMessage>({
        api: `/api/agents/${agentId}/chat`,
        body: () => ({
          conversationId: conversationIdRef.current,
          mode: "chat",
          visitorId: visitorIdRef.current,
        }),
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          const conversationId = response.headers.get("X-Conversation-Id");
          if (conversationId) {
            conversationIdRef.current = conversationId;
          }
          return response;
        },
      }),
    [agentId],
  );

  const { messages, sendMessage, status, error, setMessages } =
    useChat<LosonoUIMessage>({
      transport,
    });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (messages.length === 0 && greeting) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          parts: [{ type: "text", text: greeting }],
        },
      ]);
    }
  }, [greeting, messages.length, setMessages]);

  async function onSubmit(values: EmbedChatValues) {
    if (isBusy) {
      return;
    }

    form.reset({ message: "" });
    await sendMessage({ text: values.message });
  }

  async function startVoice() {
    setVoiceStatus("checking");
    const params = new URLSearchParams({
      mode: "deploy",
      visitorId: visitorIdRef.current,
    });

    const response = await fetch(
      `/api/agents/${agentId}/voice?${params.toString()}`,
    );
    const data = (await response.json()) as {
      voiceAvailable?: boolean;
      reason?: string;
    };

    if (!response.ok || !data.voiceAvailable) {
      setVoiceStatus(data.reason ?? "Voice unavailable");
      return;
    }

    setVoiceStatus(
      "Voice sessions open from the hosted widget. Use the API with an API key for full voice control.",
    );
  }

  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-background shadow-lg ring-1 ring-border"
        aria-label={`Chat with ${agentName}`}
      >
        <Image
          src="/logo-mark.svg"
          alt=""
          width={32}
          height={32}
          className="size-8"
          aria-hidden
        />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-background",
        compact
          ? "fixed bottom-5 right-5 z-50 h-[min(640px,80vh)] w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border shadow-2xl"
          : "min-h-screen",
      )}
    >
      <header
        className="flex items-center justify-between gap-3 px-4 py-3 text-white"
        style={{ backgroundColor: primaryColor }}
      >
        <div>
          <h1 className="font-medium">{agentName}</h1>
          <p className="flex items-center gap-1.5 text-xs text-white/80">
            <Image
              src="/logo-mark.svg"
              alt=""
              width={14}
              height={14}
              className="size-3.5 rounded-sm"
              aria-hidden
            />
            Powered by Losono
          </p>
        </div>
        {compact && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-1 hover:bg-white/10"
            aria-label="Close chat"
          >
            <X className="size-5" />
          </button>
        )}
      </header>

      {voiceEnabled && (
        <div className="flex gap-2 border-b border-border px-4 py-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "chat" ? "default" : "outline"}
            onClick={() => setMode("chat")}
          >
            Chat
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "voice" ? "default" : "outline"}
            onClick={() => {
              setMode("voice");
              void startVoice();
            }}
          >
            <Mic />
            Voice
          </Button>
        </div>
      )}

      {mode === "voice" ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {voiceStatus === "idle" || voiceStatus === "checking"
            ? "Checking voice availability…"
            : voiceStatus}
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => {
              const text = getMessageText(message);
              if (!text) {
                return null;
              }

              return (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap",
                    message.role === "user"
                      ? "ml-auto text-white"
                      : "bg-muted text-foreground",
                  )}
                  style={
                    message.role === "user"
                      ? { backgroundColor: primaryColor }
                      : undefined
                  }
                >
                  {text}
                </div>
              );
            })}

            {isBusy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          {error && (
            <div className="mx-4 mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error.message}
            </div>
          )}

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex items-end gap-2 border-t border-border p-4"
            noValidate
          >
            <textarea
              placeholder="Type a message…"
              rows={2}
              className="min-h-11 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-invalid={!!form.formState.errors.message}
              {...form.register("message")}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button
              type="submit"
              disabled={isBusy || !message.trim()}
              size="icon-lg"
              style={{ backgroundColor: primaryColor }}
            >
              <Send />
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
