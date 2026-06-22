"use client";

import { useChat } from "@ai-sdk/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, Send } from "lucide-react";
import { useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { getMessageText } from "@/lib/chat/message-text";
import { cn } from "@/lib/utils";

type LosonoUIMessage = UIMessage;

const chatMessageSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
});

type ChatMessageValues = z.infer<typeof chatMessageSchema>;

type AgentChatProps = {
  agentId: string;
  agentName: string;
};

export function AgentChat({ agentId, agentName }: AgentChatProps) {
  const conversationIdRef = useRef<string | undefined>(undefined);

  const form = useForm<ChatMessageValues>({
    resolver: zodResolver(chatMessageSchema),
    defaultValues: { message: "" },
  });

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
  const message = form.watch("message");

  async function onSubmit(values: ChatMessageValues) {
    if (isBusy) {
      return;
    }

    form.reset({ message: "" });
    await sendMessage({ text: values.message });
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
          messages.map((msg) => {
            const text = getMessageText(msg);
            if (!text) {
              return null;
            }

            const isUser = msg.role === "user";

            return (
              <div
                key={msg.id}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3",
                  isUser
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {isUser ? (
                  <p className="text-sm whitespace-pre-wrap">{text}</p>
                ) : (
                  <ChatMarkdown content={text} />
                )}
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
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex shrink-0 items-end gap-2 border-t border-border p-4"
        noValidate
      >
        <div className="min-h-11 flex-1">
          <Textarea
            placeholder="Type a test message…"
            rows={2}
            className="min-h-11 resize-none"
            aria-invalid={!!form.formState.errors.message}
            {...form.register("message")}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <FieldError errors={[form.formState.errors.message]} />
        </div>
        <Button
          type="submit"
          disabled={isBusy || !message.trim()}
          size="icon-lg"
        >
          <Send />
          <span className="sr-only">Send message</span>
        </Button>
      </form>
    </section>
  );
}
