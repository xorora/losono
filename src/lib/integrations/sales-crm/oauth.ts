import {
  getSalesCrmRedirectUri,
  normalizeSalesCrmBaseUrl,
  SALES_CRM_OAUTH_CLIENT_ID,
  SALES_CRM_SCOPES,
} from "@/lib/integrations/sales-crm/config";
import { SalesCrmError } from "@/lib/integrations/sales-crm/errors";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from "@/lib/integrations/sales-crm/pkce";
import type { SalesCrmTokenResponse } from "@/lib/integrations/sales-crm/types";

export { generateCodeVerifier, generateOAuthState };

export function buildSalesCrmAuthorizeUrl(input: {
  salesCrmBaseUrl: string;
  state: string;
  codeVerifier: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: SALES_CRM_OAUTH_CLIENT_ID,
    redirect_uri: getSalesCrmRedirectUri(),
    scope: SALES_CRM_SCOPES.join(" "),
    state: input.state,
    code_challenge: generateCodeChallenge(input.codeVerifier),
    code_challenge_method: "S256",
  });

  const baseUrl = normalizeSalesCrmBaseUrl(input.salesCrmBaseUrl);

  return `${baseUrl}/oauth/authorize?${params.toString()}`;
}

async function requestSalesCrmTokens(
  salesCrmBaseUrl: string,
  params: URLSearchParams,
): Promise<SalesCrmTokenResponse> {
  params.set("client_id", SALES_CRM_OAUTH_CLIENT_ID);

  const baseUrl = normalizeSalesCrmBaseUrl(salesCrmBaseUrl);

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const body = (await response.json().catch(() => null)) as
    | SalesCrmTokenResponse
    | { error?: string; error_description?: string }
    | null;

  if (!response.ok) {
    const message =
      body && "error_description" in body && body.error_description
        ? body.error_description
        : body && "error" in body && body.error
          ? body.error
          : "Token request failed";

    throw new SalesCrmError(message, undefined, response.status);
  }

  if (
    !body ||
    !("access_token" in body) ||
    !body.access_token ||
    !body.refresh_token
  ) {
    throw new SalesCrmError("Invalid token response from Sales CRM");
  }

  return body;
}

export async function exchangeSalesCrmAuthorizationCode(input: {
  salesCrmBaseUrl: string;
  code: string;
  codeVerifier: string;
}): Promise<SalesCrmTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: getSalesCrmRedirectUri(),
    code_verifier: input.codeVerifier,
  });

  return requestSalesCrmTokens(input.salesCrmBaseUrl, params);
}

export async function refreshSalesCrmTokens(
  salesCrmBaseUrl: string,
  refreshToken: string,
): Promise<SalesCrmTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return requestSalesCrmTokens(salesCrmBaseUrl, params);
}

export async function revokeSalesCrmToken(
  salesCrmBaseUrl: string,
  token: string,
): Promise<void> {
  const params = new URLSearchParams({
    token,
    client_id: SALES_CRM_OAUTH_CLIENT_ID,
  });

  const baseUrl = normalizeSalesCrmBaseUrl(salesCrmBaseUrl);

  const response = await fetch(`${baseUrl}/oauth/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error_description?: string;
      error?: string;
    } | null;

    const message =
      body?.error_description ??
      body?.error ??
      "Failed to revoke Sales CRM token";

    throw new SalesCrmError(message, undefined, response.status);
  }
}

export function tokenExpiresAtFromResponse(
  tokenResponse: SalesCrmTokenResponse,
): Date {
  return new Date(Date.now() + tokenResponse.expires_in * 1000);
}
