"use client";

import { useChat } from "@ai-sdk/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, Mic, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PreChatForm } from "@/components/embed/pre-chat-form";
import { WidgetLogo } from "@/components/embed/widget-logo";
import { AgentVoice } from "@/components/voice/agent-voice";
import { getMessageText } from "@/lib/chat/message-text";
import {
  getPreChatStorageKey,
  isPreChatFormActive,
  type PreChatFormConfig,
  resolvePreChatForm,
} from "@/lib/pre-chat-form";
import { cn } from "@/lib/utils";
import type { WidgetAppearance } from "@/lib/widget-theme";
import { widgetThemeStyle } from "@/lib/widget-theme";

const embedChatSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
});

type EmbedChatValues = z.infer<typeof embedChatSchema>;

type LosonoUIMessage = UIMessage;

type EmbedWidgetProps = {
  agentId: string;
  agentName: string;
  greeting: string;
  appearance: WidgetAppearance;
  voiceEnabled: boolean;
  preChatForm?: PreChatFormConfig;
  defaultOpen?: boolean;
  compact?: boolean;
  position?: "bottom-right" | "bottom-left";
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

type StoredChatSession = {
  conversationId?: string;
  messages: LosonoUIMessage[];
};

function getChatStorageKey(agentId: string, visitorId: string) {
  return `losono_chat_${agentId}_${visitorId}`;
}

function loadChatSession(
  agentId: string,
  visitorId: string,
): StoredChatSession | null {
  try {
    const raw = localStorage.getItem(getChatStorageKey(agentId, visitorId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredChatSession;
  } catch {
    return null;
  }
}

function saveChatSession(
  agentId: string,
  visitorId: string,
  session: StoredChatSession,
) {
  try {
    localStorage.setItem(
      getChatStorageKey(agentId, visitorId),
      JSON.stringify(session),
    );
  } catch {
    // Ignore quota or serialization errors.
  }
}

export function EmbedWidget({
  agentId,
  agentName,
  greeting,
  appearance,
  voiceEnabled,
  preChatForm,
  defaultOpen = false,
  compact = false,
  position = "bottom-right",
}: EmbedWidgetProps) {
  const resolvedPreChatForm = resolvePreChatForm(preChatForm);
  const preChatRequired = isPreChatFormActive(resolvedPreChatForm);
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<"chat" | "voice">("chat");
  const [visitorId, setVisitorId] = useState("");
  const [preChatComplete, setPreChatComplete] = useState(!preChatRequired);
  const [preChatChecking, setPreChatChecking] = useState(preChatRequired);
  const anchorEdge = position === "bottom-left" ? "left-0" : "right-0";
  const form = useForm<EmbedChatValues>({
    resolver: zodResolver(embedChatSchema),
    defaultValues: { message: "" },
  });
  const message = form.watch("message");
  const conversationIdRef = useRef<string | undefined>(undefined);
  const visitorIdRef = useRef<string>("");
  const hydratedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const embedResizeInitializedRef = useRef(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const { messages, sendMessage, status, error, setMessages } =
    useChat<LosonoUIMessage>({
      transport: useMemo(
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
              const nextConversationId =
                response.headers.get("X-Conversation-Id");
              if (nextConversationId) {
                conversationIdRef.current = nextConversationId;
                setConversationId(nextConversationId);
              }
              return response;
            },
          }),
        [agentId],
      ),
    });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const id = getVisitorId();
    visitorIdRef.current = id;
    setVisitorId(id);

    const stored = loadChatSession(agentId, id);
    if (stored?.conversationId) {
      conversationIdRef.current = stored.conversationId;
      setConversationId(stored.conversationId);
    }

    if (stored?.messages && stored.messages.length > 0) {
      setMessages(stored.messages);
    } else if (greeting) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          parts: [{ type: "text", text: greeting }],
        },
      ]);
    }

    hydratedRef.current = true;
  }, [agentId, greeting, setMessages]);

  useEffect(() => {
    if (!preChatRequired || !visitorId) {
      setPreChatChecking(false);
      return;
    }

    const cachedSubmissionId = localStorage.getItem(
      getPreChatStorageKey(agentId, visitorId),
    );

    if (!cachedSubmissionId) {
      setPreChatComplete(false);
      setPreChatChecking(false);
      return;
    }

    let cancelled = false;

    void fetch(
      `/api/agents/${agentId}/pre-chat?visitorId=${encodeURIComponent(visitorId)}`,
    )
      .then((response) => response.json())
      .then((data: { submitted?: boolean; submissionId?: string }) => {
        if (cancelled) {
          return;
        }

        if (data.submitted && data.submissionId) {
          localStorage.setItem(
            getPreChatStorageKey(agentId, visitorId),
            data.submissionId,
          );
          setPreChatComplete(true);
        } else {
          localStorage.removeItem(getPreChatStorageKey(agentId, visitorId));
          setPreChatComplete(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreChatComplete(Boolean(cachedSubmissionId));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreChatChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, preChatRequired, visitorId]);

  function handlePreChatComplete(submissionId: string) {
    if (visitorId) {
      localStorage.setItem(
        getPreChatStorageKey(agentId, visitorId),
        submissionId,
      );
    }
    setPreChatComplete(true);
  }

  useEffect(() => {
    if (!hydratedRef.current || !visitorId) {
      return;
    }

    saveChatSession(agentId, visitorId, {
      conversationId,
      messages,
    });
  }, [agentId, visitorId, messages, conversationId]);

  useEffect(() => {
    if (messages.length === 0 && !isBusy) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBusy]);

  useEffect(() => {
    if (!compact || !open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        launcherRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [compact, open]);

  useEffect(() => {
    if (!compact || window.parent === window) {
      return;
    }

    if (!embedResizeInitializedRef.current) {
      embedResizeInitializedRef.current = true;
      window.parent.postMessage({ type: "losono:embed:resize", open }, "*");
      return;
    }

    if (open) {
      window.parent.postMessage(
        { type: "losono:embed:resize", open: true },
        "*",
      );
      return;
    }

    const timer = window.setTimeout(() => {
      window.parent.postMessage(
        { type: "losono:embed:resize", open: false },
        "*",
      );
    }, 300);

    return () => window.clearTimeout(timer);
  }, [compact, open]);

  useEffect(() => {
    if (!compact) {
      return;
    }

    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "losono:embed:close") {
        setOpen(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [compact]);

  async function onSubmit(values: EmbedChatValues) {
    if (isBusy) {
      return;
    }

    form.reset({ message: "" });
    await sendMessage({ text: values.message });
  }

  const themeStyle = widgetThemeStyle(appearance);

  const launcherButton = compact ? (
    <button
      ref={launcherRef}
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      className={cn(
        "absolute bottom-0 flex size-14 shrink-0 items-center justify-center rounded-full shadow-md ring-1 ring-(--widget-launcher-border)",
        anchorEdge,
      )}
      style={{
        backgroundColor: appearance.backgroundColor,
      }}
      aria-label={
        open ? `Close chat with ${agentName}` : `Chat with ${agentName}`
      }
      aria-expanded={open}
    >
      <WidgetLogo
        src={appearance.logoUrl}
        width={32}
        height={32}
        className="size-8 object-contain"
      />
    </button>
  ) : null;

  const panel = (
    <div
      ref={compact ? panelRef : undefined}
      aria-hidden={compact ? !open : undefined}
      inert={compact && !open ? true : undefined}
      className={cn(
        "flex min-h-0 flex-col",
        compact
          ? cn(
              "absolute bottom-[4.25rem] h-[min(640px,80vh)] w-[min(400px,calc(100vw-2rem))] origin-bottom-right overflow-hidden rounded-2xl border border-(--widget-window-border) shadow-xl transition-[opacity,transform] duration-300 ease-out",
              anchorEdge,
              position === "bottom-left" && "origin-bottom-left",
              open
                ? "scale-100 opacity-100 delay-75"
                : "pointer-events-none scale-95 opacity-0 delay-0",
            )
          : "h-dvh min-h-0 overflow-hidden",
      )}
      style={themeStyle}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 px-4 py-3"
        style={{
          backgroundColor: appearance.userBubbleColor,
          color: appearance.userFontColor,
        }}
      >
        <div>
          <h1 className="font-medium">{agentName}</h1>
          <p
            className="flex items-center gap-1.5 text-xs opacity-80"
            style={{ color: appearance.userFontColor }}
          >
            <WidgetLogo
              src={appearance.logoUrl}
              width={14}
              height={14}
              className="size-3.5 rounded-sm object-contain"
            />
            Powered by Losono
          </p>
        </div>
      </header>

      {preChatChecking ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8">
          <Loader2
            className="size-6 animate-spin"
            style={{ color: "var(--widget-muted-text)" }}
          />
        </div>
      ) : !preChatComplete ? (
        <PreChatForm
          agentId={agentId}
          visitorId={visitorId}
          config={resolvedPreChatForm}
          appearance={appearance}
          onComplete={handlePreChatComplete}
        />
      ) : (
        <>
          {voiceEnabled && (
            <div
              className="flex shrink-0 gap-2 border-b border-(--widget-border) px-4 py-2"
              style={{ backgroundColor: appearance.backgroundColor }}
            >
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm font-medium"
                style={
                  mode === "chat"
                    ? {
                        backgroundColor: appearance.userBubbleColor,
                        color: appearance.userFontColor,
                      }
                    : {
                        backgroundColor: "transparent",
                        color: appearance.assistantFontColor,
                        border: "1px solid var(--widget-border)",
                      }
                }
                onClick={() => setMode("chat")}
              >
                Chat
              </button>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm font-medium"
                style={
                  mode === "voice"
                    ? {
                        backgroundColor: appearance.userBubbleColor,
                        color: appearance.userFontColor,
                      }
                    : {
                        backgroundColor: "transparent",
                        color: appearance.assistantFontColor,
                        border: "1px solid var(--widget-border)",
                      }
                }
                onClick={() => setMode("voice")}
              >
                <Mic className="size-3.5" />
                Voice
              </button>
            </div>
          )}

          {mode === "voice" ? (
            <AgentVoice
              agentId={agentId}
              agentName={agentName}
              voiceAvailable={voiceEnabled}
              mode="deploy"
              visitorId={visitorId}
              embedded
              appearance={appearance}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
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
                        message.role === "user" && "ml-auto",
                      )}
                      style={
                        message.role === "user"
                          ? {
                              backgroundColor: appearance.userBubbleColor,
                              color: appearance.userFontColor,
                            }
                          : {
                              backgroundColor: appearance.assistantBubbleColor,
                              color: appearance.assistantFontColor,
                            }
                      }
                    >
                      {text}
                    </div>
                  );
                })}

                {isBusy && (
                  <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: "var(--widget-muted-text)" }}
                  >
                    <Loader2 className="size-4 animate-spin" />
                    Thinking…
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {error && (
                <div className="mx-4 mb-2 shrink-0 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error.message}
                </div>
              )}

              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex shrink-0 items-end gap-2 border-t border-(--widget-border) p-4"
                style={{ backgroundColor: appearance.backgroundColor }}
                noValidate
              >
                <textarea
                  placeholder="Type a message…"
                  rows={2}
                  className="min-h-11 flex-1 resize-none rounded-xl border border-(--widget-input-border) px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--widget-user-bubble)/30"
                  style={{
                    backgroundColor: appearance.backgroundColor,
                    color: appearance.assistantFontColor,
                  }}
                  aria-invalid={!!form.formState.errors.message}
                  {...form.register("message")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isBusy || !message.trim()}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg disabled:pointer-events-none disabled:opacity-50"
                  style={{
                    backgroundColor: appearance.sendButtonColor,
                    color: appearance.sendButtonIconColor,
                  }}
                >
                  <Send
                    className="size-4"
                    style={{ color: appearance.sendButtonIconColor }}
                  />
                  <span className="sr-only">Send message</span>
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className="relative h-full w-full bg-transparent">
        {panel}
        {launcherButton}
      </div>
    );
  }

  return panel;
}
