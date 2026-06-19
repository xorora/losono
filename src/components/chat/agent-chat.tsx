"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LosonoUIMessage = UIMessage;

type AgentChatProps = {
  agentId: string;
  agentName: string;
};

function getMessageText(message: LosonoUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function AgentChat({ agentId, agentName }: AgentChatProps) {
  const conversationIdRef = useRef<string | undefined>(undefined);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport<LosonoUIMessage>({
        api: `/api/agents/${agentId}/chat`,
        body: () => ({
          conversationId: conversationIdRef.current,
          mode: "playground",
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

  const { messages, sendMessage, status, error } = useChat<LosonoUIMessage>({
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) {
      return;
    }

    setInput("");
    await sendMessage({ text });
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <header className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="font-medium">Chat with {agentName}</h2>
        <p className="text-sm text-muted-foreground">
          Test your agent with streaming responses and live RAG retrieval.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ask a question to test how your agent uses its prompt and uploaded
            context.
          </div>
        ) : (
          messages.map((message) => {
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
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {text}
              </div>
            );
          })
        )}

        {isBusy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 shrink-0 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error.message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-end gap-2 border-t border-border p-4"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a test message…"
          rows={2}
          className="min-h-11 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={isBusy || !input.trim()} size="icon-lg">
          <Send />
          <span className="sr-only">Send message</span>
        </Button>
      </form>
    </section>
  );
}
