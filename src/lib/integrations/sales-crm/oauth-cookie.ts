import { cookies } from "next/headers";

export const SALES_CRM_OAUTH_COOKIE = "sales_crm_oauth";
const COOKIE_MAX_AGE_SECONDS = 600;

export type SalesCrmOAuthCookiePayload = {
  state: string;
  codeVerifier: string;
  returnAgentId: string | null;
  salesCrmBaseUrl: string;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function setSalesCrmOAuthCookie(
  payload: SalesCrmOAuthCookiePayload,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SALES_CRM_OAUTH_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/api/integrations/sales-crm",
  });
}

export async function readSalesCrmOAuthCookie(): Promise<SalesCrmOAuthCookiePayload | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SALES_CRM_OAUTH_COOKIE)?.value;

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as SalesCrmOAuthCookiePayload;

    if (
      typeof parsed.state !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.salesCrmBaseUrl !== "string" ||
      (parsed.returnAgentId !== null &&
        typeof parsed.returnAgentId !== "string")
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function clearSalesCrmOAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: SALES_CRM_OAUTH_COOKIE,
    path: "/api/integrations/sales-crm",
  });
}

export function buildSalesCrmReturnUrl(
  agentId: string | null,
  params: Record<string, string> = {},
): string {
  const search = new URLSearchParams(params);
  const query = search.toString();
  const suffix = query ? `?${query}` : "";

  if (agentId) {
    return `/agents/${agentId}/forms${suffix}`;
  }

  return `/dashboard${suffix}`;
}
