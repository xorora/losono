"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import {
  buildPreChatResponseSchema,
  type PreChatFormConfig,
} from "@/lib/pre-chat-form";
import { cn } from "@/lib/utils";
import type { WidgetAppearance } from "@/lib/widget-theme";

type PreChatFormProps = {
  agentId: string;
  visitorId: string;
  config: PreChatFormConfig;
  appearance: WidgetAppearance;
  onComplete: (submissionId: string) => void;
};

export function PreChatForm({
  agentId,
  visitorId,
  config,
  appearance,
  onComplete,
}: PreChatFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const schema = useMemo(() => buildPreChatResponseSchema(config), [config]);

  const defaultValues = useMemo(
    () => Object.fromEntries(config.fields.map((field) => [field.id, ""])),
    [config.fields],
  );

  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema) as Resolver<Record<string, string>>,
    defaultValues,
  });

  async function onSubmit(values: Record<string, string>) {
    setSubmitError(null);

    try {
      const response = await fetch(`/api/agents/${agentId}/pre-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          responses: values,
        }),
      });

      const data = (await response.json()) as {
        submissionId?: string;
        error?: string;
        details?: Record<string, string[] | undefined>;
      };

      if (!response.ok) {
        if (data.details) {
          for (const [fieldId, messages] of Object.entries(data.details)) {
            if (messages?.[0]) {
              form.setError(fieldId, {
                message: messages[0],
              });
            }
          }
        }

        throw new Error(
          data.error === "validation_failed"
            ? "Please fix the highlighted fields."
            : "Failed to submit form. Please try again.",
        );
      }

      if (!data.submissionId) {
        throw new Error("Failed to submit form. Please try again.");
      }

      onComplete(data.submissionId);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit form.",
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          <h2
            className="text-base font-medium"
            style={{ color: appearance.assistantFontColor }}
          >
            {config.title}
          </h2>
          {config.description && (
            <p
              className="text-sm"
              style={{ color: "var(--widget-muted-text)" }}
            >
              {config.description}
            </p>
          )}
        </div>

        <form
          id="pre-chat-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {config.fields.map((field) => {
            const error = form.formState.errors[field.id];
            const fieldId = `pre-chat-${field.id}`;

            return (
              <div key={field.id} className="space-y-1.5">
                <label
                  htmlFor={fieldId}
                  className="text-sm font-medium"
                  style={{ color: appearance.assistantFontColor }}
                >
                  {field.label}
                  {field.required && (
                    <span className="text-destructive"> *</span>
                  )}
                </label>

                {field.type === "textarea" ? (
                  <textarea
                    id={fieldId}
                    rows={3}
                    placeholder={field.placeholder}
                    className={cn(
                      "w-full resize-none rounded-xl border border-(--widget-input-border) px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--widget-user-bubble)/30",
                      error && "border-destructive/50",
                    )}
                    style={{
                      backgroundColor: appearance.backgroundColor,
                      color: appearance.assistantFontColor,
                    }}
                    aria-invalid={!!error}
                    {...form.register(field.id)}
                  />
                ) : field.type === "select" ? (
                  <select
                    id={fieldId}
                    className={cn(
                      "h-10 w-full rounded-xl border border-(--widget-input-border) px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--widget-user-bubble)/30",
                      error && "border-destructive/50",
                    )}
                    style={{
                      backgroundColor: appearance.backgroundColor,
                      color: appearance.assistantFontColor,
                    }}
                    aria-invalid={!!error}
                    defaultValue=""
                    {...form.register(field.id)}
                  >
                    <option value="" disabled>
                      {field.placeholder ?? "Select an option"}
                    </option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={fieldId}
                    type={
                      field.type === "email"
                        ? "email"
                        : field.type === "phone"
                          ? "tel"
                          : "text"
                    }
                    placeholder={field.placeholder}
                    className={cn(
                      "h-10 w-full rounded-xl border border-(--widget-input-border) px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--widget-user-bubble)/30",
                      error && "border-destructive/50",
                    )}
                    style={{
                      backgroundColor: appearance.backgroundColor,
                      color: appearance.assistantFontColor,
                    }}
                    aria-invalid={!!error}
                    {...form.register(field.id)}
                  />
                )}

                {error?.message && (
                  <p className="text-xs text-destructive">{error.message}</p>
                )}
              </div>
            );
          })}
        </form>

        {submitError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {submitError}
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t border-(--widget-border) p-4"
        style={{ backgroundColor: appearance.backgroundColor }}
      >
        <button
          type="submit"
          form="pre-chat-form"
          disabled={form.formState.isSubmitting}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium disabled:pointer-events-none disabled:opacity-50"
          style={{
            backgroundColor: appearance.sendButtonColor,
            color: appearance.sendButtonIconColor,
          }}
        >
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting…
            </>
          ) : (
            (config.submitLabel ?? "Continue")
          )}
        </button>
      </div>
    </div>
  );
}
