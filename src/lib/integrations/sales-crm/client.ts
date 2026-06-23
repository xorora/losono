import {
  getCrmIntegrationForUser,
  getDecryptedAccessToken,
  getDecryptedRefreshToken,
  getSalesCrmBaseUrlForIntegration,
  isAccessTokenExpired,
  isCrmIntegrationConnected,
  markCrmIntegrationDisconnected,
  updateCrmIntegrationTokens,
} from "@/lib/db/queries/crm-integrations";
import type { CrmIntegration } from "@/lib/db/schema";
import { normalizeSalesCrmBaseUrl } from "@/lib/integrations/sales-crm/config";
import {
  SalesCrmError,
  SalesCrmNotConnectedError,
} from "@/lib/integrations/sales-crm/errors";
import {
  refreshSalesCrmTokens,
  tokenExpiresAtFromResponse,
} from "@/lib/integrations/sales-crm/oauth";
import type {
  SalesCrmApiErrorBody,
  SalesCrmBulkCreateLeadsResult,
  SalesCrmBulkLeadInput,
  SalesCrmCampaign,
  SalesCrmCreateLeadInput,
  SalesCrmCreateLeadResult,
  SalesCrmField,
} from "@/lib/integrations/sales-crm/types";

async function salesCrmRequest<T>(
  salesCrmBaseUrl: string,
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = normalizeSalesCrmBaseUrl(salesCrmBaseUrl);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as
    | T
    | SalesCrmApiErrorBody
    | null;

  if (!response.ok) {
    const errorBody = body as SalesCrmApiErrorBody | null;
    throw new SalesCrmError(
      errorBody?.message ?? "Sales CRM request failed",
      errorBody?.error,
      response.status,
    );
  }

  return body as T;
}

async function ensureValidIntegration(userId: string): Promise<CrmIntegration> {
  const integration = await getCrmIntegrationForUser(userId);

  if (!integration || !isCrmIntegrationConnected(integration)) {
    throw new SalesCrmNotConnectedError();
  }

  if (!isAccessTokenExpired(integration)) {
    return integration;
  }

  const salesCrmBaseUrl = getSalesCrmBaseUrlForIntegration(integration);

  try {
    const refreshToken = getDecryptedRefreshToken(integration);
    const tokenResponse = await refreshSalesCrmTokens(
      salesCrmBaseUrl,
      refreshToken,
    );

    return updateCrmIntegrationTokens(integration.id, {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: tokenExpiresAtFromResponse(tokenResponse),
    });
  } catch (error) {
    const message =
      error instanceof SalesCrmError
        ? error.message
        : "Token refresh failed. Please reconnect.";

    await markCrmIntegrationDisconnected(integration.id, message);
    throw new SalesCrmNotConnectedError(message);
  }
}

export async function getSalesCrmAccessToken(userId: string): Promise<{
  accessToken: string;
  salesCrmBaseUrl: string;
}> {
  const integration = await ensureValidIntegration(userId);

  return {
    accessToken: getDecryptedAccessToken(integration),
    salesCrmBaseUrl: getSalesCrmBaseUrlForIntegration(integration),
  };
}

export async function listSalesCrmCampaigns(
  userId: string,
): Promise<SalesCrmCampaign[]> {
  const { accessToken, salesCrmBaseUrl } = await getSalesCrmAccessToken(userId);
  const response = await salesCrmRequest<{ campaigns: SalesCrmCampaign[] }>(
    salesCrmBaseUrl,
    accessToken,
    "/api/v1/campaigns",
  );

  return response.campaigns;
}

export async function getSalesCrmCampaignFields(
  userId: string,
  campaignId: string,
): Promise<SalesCrmField[]> {
  const { accessToken, salesCrmBaseUrl } = await getSalesCrmAccessToken(userId);
  const response = await salesCrmRequest<{ fields: SalesCrmField[] }>(
    salesCrmBaseUrl,
    accessToken,
    `/api/v1/campaigns/${campaignId}/fields`,
  );

  return response.fields;
}

export async function createSalesCrmLead(
  userId: string,
  input: SalesCrmCreateLeadInput,
): Promise<SalesCrmCreateLeadResult> {
  const { accessToken, salesCrmBaseUrl } = await getSalesCrmAccessToken(userId);

  return salesCrmRequest<SalesCrmCreateLeadResult>(
    salesCrmBaseUrl,
    accessToken,
    "/api/v1/leads",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createSalesCrmLeadsBulk(
  userId: string,
  input: {
    campaignId: string;
    leads: SalesCrmBulkLeadInput[];
  },
): Promise<SalesCrmBulkCreateLeadsResult> {
  const { accessToken, salesCrmBaseUrl } = await getSalesCrmAccessToken(userId);

  return salesCrmRequest<SalesCrmBulkCreateLeadsResult>(
    salesCrmBaseUrl,
    accessToken,
    "/api/v1/leads/bulk",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
