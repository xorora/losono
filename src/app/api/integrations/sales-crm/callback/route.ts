import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { upsertCrmIntegrationTokens } from "@/lib/db/queries/crm-integrations";
import { SalesCrmError } from "@/lib/integrations/sales-crm/errors";
import {
  exchangeSalesCrmAuthorizationCode,
  tokenExpiresAtFromResponse,
} from "@/lib/integrations/sales-crm/oauth";
import {
  buildSalesCrmReturnUrl,
  clearSalesCrmOAuthCookie,
  readSalesCrmOAuthCookie,
} from "@/lib/integrations/sales-crm/oauth-cookie";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookiePayload = await readSalesCrmOAuthCookie();
  const returnAgentId = cookiePayload?.returnAgentId ?? null;

  await clearSalesCrmOAuthCookie();

  if (!userId) {
    return NextResponse.redirect(
      new URL(
        buildSalesCrmReturnUrl(returnAgentId, { crm_error: "unauthorized" }),
        request.url,
      ),
    );
  }

  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        buildSalesCrmReturnUrl(returnAgentId, {
          crm_error: oauthErrorDescription ?? oauthError,
        }),
        request.url,
      ),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(
        buildSalesCrmReturnUrl(returnAgentId, {
          crm_error: "missing_authorization_code",
        }),
        request.url,
      ),
    );
  }

  if (!cookiePayload || cookiePayload.state !== state) {
    return NextResponse.redirect(
      new URL(
        buildSalesCrmReturnUrl(returnAgentId, { crm_error: "invalid_state" }),
        request.url,
      ),
    );
  }

  try {
    const tokenResponse = await exchangeSalesCrmAuthorizationCode({
      salesCrmBaseUrl: cookiePayload.salesCrmBaseUrl,
      code,
      codeVerifier: cookiePayload.codeVerifier,
    });

    await upsertCrmIntegrationTokens({
      userId,
      salesCrmBaseUrl: cookiePayload.salesCrmBaseUrl,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: tokenExpiresAtFromResponse(tokenResponse),
    });

    return NextResponse.redirect(
      new URL(
        buildSalesCrmReturnUrl(returnAgentId, { crm: "connected" }),
        request.url,
      ),
    );
  } catch (error) {
    console.error("Sales CRM OAuth callback error:", error);

    const message =
      error instanceof SalesCrmError ? error.message : "connection_failed";

    return NextResponse.redirect(
      new URL(
        buildSalesCrmReturnUrl(returnAgentId, { crm_error: message }),
        request.url,
      ),
    );
  }
}
