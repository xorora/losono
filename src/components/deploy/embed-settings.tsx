"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, ImageIcon, X } from "lucide-react";
import { useRef } from "react";
import { Controller, type UseFormRegister, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { WidgetLogo } from "@/components/embed/widget-logo";
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
import {
  DEFAULT_WIDGET_THEME,
  WIDGET_LOGO_MAX_BYTES,
  type WidgetAppearance,
} from "@/lib/widget-theme";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color");

const embedSettingsSchema = z.object({
  greeting: z.string(),
  position: z.enum(["bottom-right", "bottom-left"]),
  allowedOrigins: z.string(),
  modes: z.enum(["chat", "chat+voice"]),
  backgroundColor: hexColor,
  userFontColor: hexColor,
  assistantFontColor: hexColor,
  userBubbleColor: hexColor,
  assistantBubbleColor: hexColor,
  sendButtonColor: hexColor,
  sendButtonIconColor: hexColor,
  windowBorderColor: hexColor,
  launcherBorderColor: hexColor,
  logoUrl: z.string(),
});

type EmbedSettingsValues = z.infer<typeof embedSettingsSchema>;

type EmbedSettingsProps = {
  agentId: string;
  slug: string;
  appUrl: string;
  published: boolean;
  initialGreeting: string;
  initialPosition: "bottom-right" | "bottom-left";
  initialAllowedOrigins: string;
  initialModes: "chat" | "chat+voice";
  initialAppearance: WidgetAppearance;
};

function ColorField({
  id,
  label,
  error,
  register,
  name,
}: {
  id: string;
  label: string;
  error?: { message?: string };
  register: UseFormRegister<EmbedSettingsValues>;
  name: keyof Pick<
    EmbedSettingsValues,
    | "backgroundColor"
    | "userFontColor"
    | "assistantFontColor"
    | "userBubbleColor"
    | "assistantBubbleColor"
    | "sendButtonColor"
    | "sendButtonIconColor"
    | "windowBorderColor"
    | "launcherBorderColor"
  >;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="color"
        className="h-9 px-1"
        aria-invalid={!!error}
        {...register(name)}
      />
      <FieldError errors={[error]} />
    </Field>
  );
}

export function EmbedSettings({
  agentId,
  slug,
  appUrl,
  published,
  initialGreeting,
  initialPosition,
  initialAllowedOrigins,
  initialModes,
  initialAppearance,
}: EmbedSettingsProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const embedUrl = `${appUrl}/embed/${slug}`;
  const scriptSnippet = `<script src="${appUrl}/embed.js" data-agent="${slug}"></script>`;

  const form = useForm<EmbedSettingsValues>({
    resolver: zodResolver(embedSettingsSchema),
    defaultValues: {
      greeting: initialGreeting,
      position: initialPosition,
      allowedOrigins: initialAllowedOrigins,
      modes: initialModes,
      backgroundColor: initialAppearance.backgroundColor,
      userFontColor: initialAppearance.userFontColor,
      assistantFontColor: initialAppearance.assistantFontColor,
      userBubbleColor: initialAppearance.userBubbleColor,
      assistantBubbleColor: initialAppearance.assistantBubbleColor,
      sendButtonColor: initialAppearance.sendButtonColor,
      sendButtonIconColor: initialAppearance.sendButtonIconColor,
      windowBorderColor: initialAppearance.windowBorderColor,
      launcherBorderColor: initialAppearance.launcherBorderColor,
      logoUrl: initialAppearance.logoUrl,
    },
  });

  const logoUrl = form.watch("logoUrl");

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
              modes: values.modes,
              backgroundColor: values.backgroundColor,
              userFontColor: values.userFontColor,
              assistantFontColor: values.assistantFontColor,
              userBubbleColor: values.userBubbleColor,
              assistantBubbleColor: values.assistantBubbleColor,
              sendButtonColor: values.sendButtonColor,
              sendButtonIconColor: values.sendButtonIconColor,
              windowBorderColor: values.windowBorderColor,
              launcherBorderColor: values.launcherBorderColor,
              logoUrl: values.logoUrl,
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

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image file");
      return;
    }

    if (file.size > WIDGET_LOGO_MAX_BYTES) {
      toast.error("Logo must be under 256 KB");
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read logo"));
        reader.readAsDataURL(file);
      });

      form.setValue("logoUrl", dataUrl, { shouldDirty: true });
    } catch (uploadError) {
      toast.error(
        uploadError instanceof Error ? uploadError.message : "Upload failed",
      );
    }
  }

  function resetLogo() {
    form.setValue("logoUrl", DEFAULT_WIDGET_THEME.logoUrl, {
      shouldDirty: true,
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Embed widget</h2>
        <p className="text-sm text-muted-foreground">
          Add the script snippet to your site or share the hosted widget URL.
          Chat works without an API key. For voice, set modes to{" "}
          <strong className="font-medium text-foreground">Chat + voice</strong>{" "}
          below (Pro plan required) — no API key needed for the embed.
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
        className="space-y-6"
        noValidate
      >
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Appearance</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              id="background-color"
              label="Background color"
              error={form.formState.errors.backgroundColor}
              register={form.register}
              name="backgroundColor"
            />
            <ColorField
              id="user-font-color"
              label="User font color"
              error={form.formState.errors.userFontColor}
              register={form.register}
              name="userFontColor"
            />
            <ColorField
              id="assistant-font-color"
              label="AI font color"
              error={form.formState.errors.assistantFontColor}
              register={form.register}
              name="assistantFontColor"
            />
            <ColorField
              id="user-bubble-color"
              label="User message color"
              error={form.formState.errors.userBubbleColor}
              register={form.register}
              name="userBubbleColor"
            />
            <ColorField
              id="assistant-bubble-color"
              label="AI message color"
              error={form.formState.errors.assistantBubbleColor}
              register={form.register}
              name="assistantBubbleColor"
            />
            <ColorField
              id="send-button-color"
              label="Send button color"
              error={form.formState.errors.sendButtonColor}
              register={form.register}
              name="sendButtonColor"
            />
            <ColorField
              id="send-button-icon-color"
              label="Send button icon color"
              error={form.formState.errors.sendButtonIconColor}
              register={form.register}
              name="sendButtonIconColor"
            />
            <ColorField
              id="window-border-color"
              label="Widget window border color"
              error={form.formState.errors.windowBorderColor}
              register={form.register}
              name="windowBorderColor"
            />
            <ColorField
              id="launcher-border-color"
              label="Widget button border color"
              error={form.formState.errors.launcherBorderColor}
              register={form.register}
              name="launcherBorderColor"
            />
          </div>

          <Field>
            <FieldLabel>Widget logo</FieldLabel>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-full border border-border bg-muted/40">
                <WidgetLogo
                  src={logoUrl || DEFAULT_WIDGET_THEME.logoUrl}
                  width={32}
                  height={32}
                  className="size-8 object-contain"
                />
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => logoInputRef.current?.click()}
              >
                <ImageIcon />
                Upload logo
              </Button>
              {logoUrl !== DEFAULT_WIDGET_THEME.logoUrl && (
                <Button type="button" variant="ghost" onClick={resetLogo}>
                  <X />
                  Reset to default
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              PNG, SVG, or JPG up to 256 KB. Shown on the launcher and widget
              header.
            </p>
          </Field>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium">Behavior</h3>
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
