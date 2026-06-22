import type { CSSProperties } from "react";

export const DEFAULT_WIDGET_THEME = {
  backgroundColor: "#ffffff",
  userFontColor: "#ffffff",
  assistantFontColor: "#0f172a",
  userBubbleColor: "#2563eb",
  assistantBubbleColor: "#f1f5f9",
  sendButtonColor: "#2563eb",
  sendButtonIconColor: "#ffffff",
  windowBorderColor: "#e2e8f0",
  launcherBorderColor: "#e2e8f0",
  logoUrl: "/logo-mark.svg",
} as const;

export type WidgetTheme = {
  greeting?: string;
  position?: "bottom-right" | "bottom-left";
  modes?: "chat" | "chat+voice";
  /** @deprecated Use granular color fields instead. */
  primaryColor?: string;
  backgroundColor?: string;
  userFontColor?: string;
  assistantFontColor?: string;
  userBubbleColor?: string;
  assistantBubbleColor?: string;
  sendButtonColor?: string;
  sendButtonIconColor?: string;
  windowBorderColor?: string;
  launcherBorderColor?: string;
  logoUrl?: string;
};

export type ResolvedWidgetTheme = {
  greeting: string;
  position: "bottom-right" | "bottom-left";
  modes: "chat" | "chat+voice";
  backgroundColor: string;
  userFontColor: string;
  assistantFontColor: string;
  userBubbleColor: string;
  assistantBubbleColor: string;
  sendButtonColor: string;
  sendButtonIconColor: string;
  windowBorderColor: string;
  launcherBorderColor: string;
  logoUrl: string;
};

export type WidgetAppearance = Pick<
  ResolvedWidgetTheme,
  | "backgroundColor"
  | "userFontColor"
  | "assistantFontColor"
  | "userBubbleColor"
  | "assistantBubbleColor"
  | "sendButtonColor"
  | "sendButtonIconColor"
  | "windowBorderColor"
  | "launcherBorderColor"
  | "logoUrl"
>;

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function resolveWidgetTheme(
  raw: WidgetTheme | Record<string, unknown> | undefined,
  options: { agentName: string },
): ResolvedWidgetTheme {
  const theme = raw ?? {};
  const legacyPrimary = isHexColor(theme.primaryColor)
    ? theme.primaryColor
    : DEFAULT_WIDGET_THEME.userBubbleColor;

  return {
    greeting:
      typeof theme.greeting === "string"
        ? theme.greeting
        : `Hi! I'm ${options.agentName}. How can I help?`,
    position: theme.position === "bottom-left" ? "bottom-left" : "bottom-right",
    modes: theme.modes === "chat+voice" ? "chat+voice" : "chat",
    backgroundColor: isHexColor(theme.backgroundColor)
      ? theme.backgroundColor
      : DEFAULT_WIDGET_THEME.backgroundColor,
    userFontColor: isHexColor(theme.userFontColor)
      ? theme.userFontColor
      : DEFAULT_WIDGET_THEME.userFontColor,
    assistantFontColor: isHexColor(theme.assistantFontColor)
      ? theme.assistantFontColor
      : DEFAULT_WIDGET_THEME.assistantFontColor,
    userBubbleColor: isHexColor(theme.userBubbleColor)
      ? theme.userBubbleColor
      : legacyPrimary,
    assistantBubbleColor: isHexColor(theme.assistantBubbleColor)
      ? theme.assistantBubbleColor
      : DEFAULT_WIDGET_THEME.assistantBubbleColor,
    sendButtonColor: isHexColor(theme.sendButtonColor)
      ? theme.sendButtonColor
      : legacyPrimary,
    sendButtonIconColor: isHexColor(theme.sendButtonIconColor)
      ? theme.sendButtonIconColor
      : DEFAULT_WIDGET_THEME.sendButtonIconColor,
    windowBorderColor: isHexColor(theme.windowBorderColor)
      ? theme.windowBorderColor
      : DEFAULT_WIDGET_THEME.windowBorderColor,
    launcherBorderColor: isHexColor(theme.launcherBorderColor)
      ? theme.launcherBorderColor
      : DEFAULT_WIDGET_THEME.launcherBorderColor,
    logoUrl:
      typeof theme.logoUrl === "string" && theme.logoUrl.length > 0
        ? theme.logoUrl
        : DEFAULT_WIDGET_THEME.logoUrl,
  };
}

export function widgetThemeStyle(appearance: WidgetAppearance): CSSProperties {
  return {
    backgroundColor: appearance.backgroundColor,
    color: appearance.assistantFontColor,
    "--widget-bg": appearance.backgroundColor,
    "--widget-user-bubble": appearance.userBubbleColor,
    "--widget-user-text": appearance.userFontColor,
    "--widget-assistant-bubble": appearance.assistantBubbleColor,
    "--widget-assistant-text": appearance.assistantFontColor,
    "--widget-send-bg": appearance.sendButtonColor,
    "--widget-send-icon": appearance.sendButtonIconColor,
    "--widget-window-border": appearance.windowBorderColor,
    "--widget-launcher-border": appearance.launcherBorderColor,
    "--widget-border": appearance.windowBorderColor,
    "--widget-input-border": `color-mix(in srgb, ${appearance.assistantFontColor} 28%, transparent)`,
    "--widget-muted-text": `color-mix(in srgb, ${appearance.assistantFontColor} 55%, transparent)`,
  } as CSSProperties;
}

export const WIDGET_LOGO_MAX_BYTES = 256 * 1024;
