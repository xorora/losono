import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAgentForUser } from "@/lib/db/queries/agents";
import {
  getCrmIntegrationForUser,
  getInitialSalesCrmBaseUrl,
  upsertCrmIntegrationUrl,
} from "@/lib/db/queries/crm-integrations";
import { resolveSalesCrmBaseUrl } from "@/lib/integrations/sales-crm/config";
import {
  buildSalesCrmAuthorizeUrl,
  generateCodeVerifier,
  generateOAuthState,
} from "@/lib/integrations/sales-crm/oauth";
import { setSalesCrmOAuthCookie } from "@/lib/integrations/sales-crm/oauth-cookie";
import { isTokenEncryptionAvailable } from "@/lib/integrations/token-encryption";

export async function GET(request: Request) {
  if (!isTokenEncryptionAvailable()) {
    return Response.json({ error: "platform_not_ready" }, { status: 503 });
  }

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");
  const salesCrmBaseUrlParam = url.searchParams.get("salesCrmBaseUrl")?.trim();

  if (agentId) {
    const agent = await getAgentForUser(agentId, userId);

    if (!agent) {
      return Response.json({ error: "agent_not_found" }, { status: 404 });
    }
  }

  let salesCrmBaseUrl: string;

  try {
    if (salesCrmBaseUrlParam) {
      salesCrmBaseUrl = resolveSalesCrmBaseUrl(salesCrmBaseUrlParam);
      await upsertCrmIntegrationUrl({ userId, salesCrmBaseUrl });
    } else {
      const integration = await getCrmIntegrationForUser(userId);
      salesCrmBaseUrl = resolveSalesCrmBaseUrl(
        getInitialSalesCrmBaseUrl(integration),
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sales CRM URL is required";

    return Response.json({ error: message }, { status: 400 });
  }

  const state = generateOAuthState();
  const codeVerifier = generateCodeVerifier();

  await setSalesCrmOAuthCookie({
    state,
    codeVerifier,
    returnAgentId: agentId,
    salesCrmBaseUrl,
  });

  const authorizeUrl = buildSalesCrmAuthorizeUrl({
    salesCrmBaseUrl,
    state,
    codeVerifier,
  });

  return NextResponse.redirect(authorizeUrl);
}
