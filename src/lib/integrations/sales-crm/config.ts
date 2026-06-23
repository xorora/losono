import { getAppUrl } from "@/lib/app-url";
import { env } from "@/lib/env";

export const SALES_CRM_OAUTH_CLIENT_ID = "losono";

export const SALES_CRM_SCOPES = ["campaigns:read", "leads:write"] as const;

export function normalizeSalesCrmBaseUrl(url: string): string {
  const trimmed = url.trim();

  if (!trimmed) {
    throw new Error("Sales CRM URL is required");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;

  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid Sales CRM URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Sales CRM URL must use http or https");
  }

  if (
    parsed.protocol === "http:" &&
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "127.0.0.1"
  ) {
    throw new Error("Use https for production Sales CRM URLs");
  }

  return `${parsed.protocol}//${parsed.host}`;
}

export function getDefaultSalesCrmBaseUrl(): string | null {
  const url = env.SALES_CRM_URL?.trim();

  if (!url) {
    return null;
  }

  return normalizeSalesCrmBaseUrl(url);
}

export function resolveSalesCrmBaseUrl(
  storedUrl: string | null | undefined,
): string {
  if (storedUrl?.trim()) {
    return normalizeSalesCrmBaseUrl(storedUrl);
  }

  const defaultUrl = getDefaultSalesCrmBaseUrl();

  if (defaultUrl) {
    return defaultUrl;
  }

  throw new Error("Sales CRM URL is not configured");
}

export function getSalesCrmRedirectUri(): string {
  return `${getAppUrl()}/api/integrations/sales-crm/callback`;
}

export function isCrmIntegrationConnected(integration: {
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
}): boolean {
  return Boolean(
    integration.accessTokenEncrypted && integration.refreshTokenEncrypted,
  );
}
