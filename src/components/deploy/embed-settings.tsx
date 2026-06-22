"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const embedSettingsSchema = z.object({
  greeting: z.string(),
  position: z.enum(["bottom-right", "bottom-left"]),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color"),
  allowedOrigins: z.string(),
  modes: z.enum(["chat", "chat+voice"]),
});

type EmbedSettingsValues = z.infer<typeof embedSettingsSchema>;

type EmbedSettingsProps = {
  agentId: string;
  slug: string;
  appUrl: string;
  published: boolean;
  initialGreeting: string;
  initialPosition: "bottom-right" | "bottom-left";
  initialPrimaryColor: string;
  initialAllowedOrigins: string;
  initialModes: "chat" | "chat+voice";
};

export function EmbedSettings({
  agentId,
  slug,
  appUrl,
  published,
  initialGreeting,
  initialPosition,
  initialPrimaryColor,
  initialAllowedOrigins,
  initialModes,
}: EmbedSettingsProps) {
  const embedUrl = `${appUrl}/embed/${slug}`;
  const scriptSnippet = `<script src="${appUrl}/embed.js" data-agent="${slug}"></script>`;

  const form = useForm<EmbedSettingsValues>({
    resolver: zodResolver(embedSettingsSchema),
    defaultValues: {
      greeting: initialGreeting,
      position: initialPosition,
      primaryColor: initialPrimaryColor,
      allowedOrigins: initialAllowedOrigins,
      modes: initialModes,
    },
  });

  async function onSubmit(values: EmbedSettingsValues) {
    const origins = values.allowedOrigins
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      const response = await fetch(`/api/agents/${agentId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            allowedOrigins: origins,
            widgetTheme: {
              greeting: values.greeting,
              position: values.position,
              primaryColor: values.primaryColor,
              modes: values.modes,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save embed settings");
      }

      toast.success("Embed settings saved");
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save embed settings",
      );
    }
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Embed widget</h2>
        <p className="text-sm text-muted-foreground">
          Add the script snippet to your site or share the hosted widget URL.
        </p>
      </div>

      {!published && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Publish this agent to activate the public embed URL.
        </p>
      )}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="embed-url">Hosted widget URL</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="embed-url"
              readOnly
              value={embedUrl}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => copyText(embedUrl, "Widget URL")}
            >
              <Copy />
            </Button>
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="script-snippet">Script snippet</FieldLabel>
          <div className="flex gap-2">
            <Textarea
              id="script-snippet"
              readOnly
              rows={2}
              value={scriptSnippet}
              className="flex-1 font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => copyText(scriptSnippet, "Script snippet")}
            >
              <Copy />
            </Button>
          </div>
        </Field>
      </FieldGroup>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!form.formState.errors.greeting}>
            <FieldLabel htmlFor="greeting">Greeting</FieldLabel>
            <Input
              id="greeting"
              aria-invalid={!!form.formState.errors.greeting}
              {...form.register("greeting")}
            />
            <FieldError errors={[form.formState.errors.greeting]} />
          </Field>

          <Field data-invalid={!!form.formState.errors.primaryColor}>
            <FieldLabel htmlFor="primary-color">Primary color</FieldLabel>
            <Input
              id="primary-color"
              type="color"
              className="h-9 px-1"
              aria-invalid={!!form.formState.errors.primaryColor}
              {...form.register("primaryColor")}
            />
            <FieldError errors={[form.formState.errors.primaryColor]} />
          </Field>

          <Field data-invalid={!!form.formState.errors.position}>
            <FieldLabel>Launcher position</FieldLabel>
            <Controller
              name="position"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Bottom right</SelectItem>
                    <SelectItem value="bottom-left">Bottom left</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.position]} />
          </Field>

          <Field data-invalid={!!form.formState.errors.modes}>
            <FieldLabel>Modes</FieldLabel>
            <Controller
              name="modes"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chat">Chat only</SelectItem>
                    <SelectItem value="chat+voice">Chat + voice</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.modes]} />
          </Field>
        </div>

        <Field data-invalid={!!form.formState.errors.allowedOrigins}>
          <FieldLabel htmlFor="allowed-origins">
            Allowed origins (one per line, empty = allow all)
          </FieldLabel>
          <Textarea
            id="allowed-origins"
            rows={3}
            placeholder={"https://example.com\nhttps://app.example.com"}
            aria-invalid={!!form.formState.errors.allowedOrigins}
            {...form.register("allowedOrigins")}
          />
          <FieldError errors={[form.formState.errors.allowedOrigins]} />
        </Field>

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="mt-2.5"
        >
          {form.formState.isSubmitting ? "Saving…" : "Save embed settings"}
        </Button>
      </form>
    </section>
  );
}
