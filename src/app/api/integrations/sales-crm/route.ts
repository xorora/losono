import { auth } from "@/auth";
import {
  deleteCrmIntegrationForUser,
  getCrmIntegrationForUser,
  getDecryptedRefreshToken,
  getSalesCrmBaseUrlForIntegration,
  isCrmIntegrationConnected,
  serializeCrmIntegration,
  updateCrmIntegrationCampaign,
  upsertCrmIntegrationUrl,
} from "@/lib/db/queries/crm-integrations";
import { listSalesCrmCampaigns } from "@/lib/integrations/sales-crm/client";
import { getDefaultSalesCrmBaseUrl } from "@/lib/integrations/sales-crm/config";
import { SalesCrmError } from "@/lib/integrations/sales-crm/errors";
import { revokeSalesCrmToken } from "@/lib/integrations/sales-crm/oauth";
import { isTokenEncryptionAvailable } from "@/lib/integrations/token-encryption";

async function requireSession() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      error: Response.json({ error: "unauthorized" }, { status: 401 }),
    } as const;
  }

  return { userId } as const;
}

export async function GET() {
  const access = await requireSession();

  if ("error" in access) {
    return access.error;
  }

  const integration = await getCrmIntegrationForUser(access.userId);
  const connected = integration
    ? isCrmIntegrationConnected(integration)
    : false;
  const defaultSalesCrmUrl = getDefaultSalesCrmBaseUrl();

  if (!integration || !connected) {
    return Response.json({
      platformReady: isTokenEncryptionAvailable(),
      defaultSalesCrmUrl,
      connected: false,
      integration: integration ? serializeCrmIntegration(integration) : null,
      campaigns: [],
    });
  }

  try {
    const campaigns = await listSalesCrmCampaigns(access.userId);

    return Response.json({
      platformReady: isTokenEncryptionAvailable(),
      defaultSalesCrmUrl,
      connected: true,
      integration: serializeCrmIntegration(integration),
      campaigns,
    });
  } catch (error) {
    console.error("Failed to load Sales CRM integration:", error);

    const message =
      error instanceof SalesCrmError
        ? error.message
        : "Failed to load campaigns";

    return Response.json({
      platformReady: isTokenEncryptionAvailable(),
      defaultSalesCrmUrl,
      connected: true,
      integration: serializeCrmIntegration(integration),
      campaigns: [],
      campaignsError: message,
    });
  }
}

type SaveIntegrationBody = {
  salesCrmBaseUrl?: string;
  campaignId?: string;
};

export async function POST(request: Request) {
  const access = await requireSession();

  if ("error" in access) {
    return access.error;
  }

  if (!isTokenEncryptionAvailable()) {
    return Response.json({ error: "platform_not_ready" }, { status: 503 });
  }

  let body: SaveIntegrationBody;

  try {
    body = (await request.json()) as SaveIntegrationBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const salesCrmBaseUrl = body.salesCrmBaseUrl?.trim();
  const campaignId = body.campaignId?.trim();

  if (salesCrmBaseUrl) {
    try {
      const integration = await upsertCrmIntegrationUrl({
        userId: access.userId,
        salesCrmBaseUrl,
      });

      return Response.json({
        integration: serializeCrmIntegration(integration),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save Sales CRM URL";

      return Response.json({ error: message }, { status: 400 });
    }
  }

  if (!campaignId) {
    return Response.json(
      { error: "campaign_id_or_sales_crm_url_required" },
      { status: 400 },
    );
  }

  const integration = await getCrmIntegrationForUser(access.userId);

  if (!integration || !isCrmIntegrationConnected(integration)) {
    return Response.json({ error: "not_connected" }, { status: 409 });
  }

  try {
    const campaigns = await listSalesCrmCampaigns(access.userId);
    const campaign = campaigns.find((item) => item.id === campaignId);

    if (!campaign) {
      return Response.json({ error: "campaign_not_found" }, { status: 404 });
    }

    const updated = await updateCrmIntegrationCampaign(integration.id, {
      campaignId: campaign.id,
      campaignName: campaign.name,
    });

    return Response.json({
      integration: serializeCrmIntegration(updated),
    });
  } catch (error) {
    console.error("Failed to save Sales CRM campaign:", error);

    const message =
      error instanceof SalesCrmError
        ? error.message
        : "Failed to save campaign";

    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const access = await requireSession();

  if ("error" in access) {
    return access.error;
  }

  const integration = await getCrmIntegrationForUser(access.userId);

  if (!integration) {
    return Response.json({ error: "not_connected" }, { status: 404 });
  }

  if (isCrmIntegrationConnected(integration)) {
    try {
      const refreshToken = getDecryptedRefreshToken(integration);
      const salesCrmBaseUrl = getSalesCrmBaseUrlForIntegration(integration);
      await revokeSalesCrmToken(salesCrmBaseUrl, refreshToken);
    } catch (error) {
      console.error("Failed to revoke Sales CRM token:", error);
    }
  }

  await deleteCrmIntegrationForUser(access.userId);

  return Response.json({ disconnected: true });
}
