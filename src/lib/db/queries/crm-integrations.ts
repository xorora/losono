import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  type CrmIntegration,
  type CrmProvider,
  crmIntegrations,
} from "@/lib/db/schema";
import {
  getDefaultSalesCrmBaseUrl,
  isCrmIntegrationConnected,
  normalizeSalesCrmBaseUrl,
  resolveSalesCrmBaseUrl,
} from "@/lib/integrations/sales-crm/config";
import {
  decryptSecret,
  encryptSecret,
} from "@/lib/integrations/token-encryption";

const SALES_CRM_PROVIDER: CrmProvider = "sales-crm";

export { isCrmIntegrationConnected };

export async function getCrmIntegrationForUser(
  userId: string,
  provider: CrmProvider = SALES_CRM_PROVIDER,
): Promise<CrmIntegration | null> {
  const [integration] = await getDb()
    .select()
    .from(crmIntegrations)
    .where(
      and(
        eq(crmIntegrations.userId, userId),
        eq(crmIntegrations.provider, provider),
      ),
    )
    .limit(1);

  return integration ?? null;
}

export function getSalesCrmBaseUrlForIntegration(
  integration: CrmIntegration,
): string {
  return resolveSalesCrmBaseUrl(integration.salesCrmBaseUrl);
}

export async function upsertCrmIntegrationUrl(input: {
  userId: string;
  salesCrmBaseUrl: string;
  provider?: CrmProvider;
}): Promise<CrmIntegration> {
  const provider = input.provider ?? SALES_CRM_PROVIDER;
  const salesCrmBaseUrl = normalizeSalesCrmBaseUrl(input.salesCrmBaseUrl);
  const existing = await getCrmIntegrationForUser(input.userId, provider);
  const now = new Date();

  if (existing) {
    const [updated] = await getDb()
      .update(crmIntegrations)
      .set({
        salesCrmBaseUrl,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(crmIntegrations.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update CRM URL");
    }

    return updated;
  }

  const [created] = await getDb()
    .insert(crmIntegrations)
    .values({
      userId: input.userId,
      provider,
      salesCrmBaseUrl,
      syncEnabled: false,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to save CRM URL");
  }

  return created;
}

export async function upsertCrmIntegrationTokens(input: {
  userId: string;
  provider?: CrmProvider;
  salesCrmBaseUrl?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}): Promise<CrmIntegration> {
  const provider = input.provider ?? SALES_CRM_PROVIDER;
  const existing = await getCrmIntegrationForUser(input.userId, provider);
  const accessTokenEncrypted = encryptSecret(input.accessToken);
  const refreshTokenEncrypted = encryptSecret(input.refreshToken);
  const now = new Date();
  const salesCrmBaseUrl = input.salesCrmBaseUrl
    ? normalizeSalesCrmBaseUrl(input.salesCrmBaseUrl)
    : (existing?.salesCrmBaseUrl ?? getDefaultSalesCrmBaseUrl());

  if (!salesCrmBaseUrl) {
    throw new Error("Sales CRM URL is required before connecting");
  }

  if (existing) {
    const [updated] = await getDb()
      .update(crmIntegrations)
      .set({
        salesCrmBaseUrl,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt: input.expiresAt,
        lastError: null,
        syncEnabled: true,
        connectedAt: existing.connectedAt ?? now,
        updatedAt: now,
      })
      .where(eq(crmIntegrations.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update CRM integration");
    }

    return updated;
  }

  const [created] = await getDb()
    .insert(crmIntegrations)
    .values({
      userId: input.userId,
      provider,
      salesCrmBaseUrl,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt: input.expiresAt,
      syncEnabled: true,
      connectedAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create CRM integration");
  }

  return created;
}

export async function updateCrmIntegrationTokens(
  integrationId: string,
  input: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  },
): Promise<CrmIntegration> {
  const [updated] = await getDb()
    .update(crmIntegrations)
    .set({
      accessTokenEncrypted: encryptSecret(input.accessToken),
      refreshTokenEncrypted: encryptSecret(input.refreshToken),
      tokenExpiresAt: input.expiresAt,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(crmIntegrations.id, integrationId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update CRM integration tokens");
  }

  return updated;
}

export async function markCrmIntegrationDisconnected(
  integrationId: string,
  errorMessage: string,
): Promise<void> {
  await getDb()
    .update(crmIntegrations)
    .set({
      syncEnabled: false,
      lastError: errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(crmIntegrations.id, integrationId));
}

export async function deleteCrmIntegrationForUser(
  userId: string,
  provider: CrmProvider = SALES_CRM_PROVIDER,
): Promise<void> {
  await getDb()
    .delete(crmIntegrations)
    .where(
      and(
        eq(crmIntegrations.userId, userId),
        eq(crmIntegrations.provider, provider),
      ),
    );
}

export function getDecryptedAccessToken(integration: CrmIntegration): string {
  if (!integration.accessTokenEncrypted) {
    throw new Error("Integration is not connected");
  }

  return decryptSecret(integration.accessTokenEncrypted);
}

export function getDecryptedRefreshToken(integration: CrmIntegration): string {
  if (!integration.refreshTokenEncrypted) {
    throw new Error("Integration is not connected");
  }

  return decryptSecret(integration.refreshTokenEncrypted);
}

export function isAccessTokenExpired(
  integration: CrmIntegration,
  bufferSeconds = 60,
): boolean {
  if (!integration.tokenExpiresAt) {
    return true;
  }

  return (
    integration.tokenExpiresAt.getTime() <= Date.now() + bufferSeconds * 1000
  );
}

export async function updateCrmIntegrationCampaign(
  integrationId: string,
  input: {
    campaignId: string;
    campaignName: string;
  },
): Promise<CrmIntegration> {
  const [updated] = await getDb()
    .update(crmIntegrations)
    .set({
      campaignId: input.campaignId,
      campaignName: input.campaignName,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(crmIntegrations.id, integrationId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update CRM integration campaign");
  }

  return updated;
}

export async function updateCrmIntegrationSyncState(
  integrationId: string,
  input: {
    lastSyncAt?: Date;
    lastError?: string | null;
  },
): Promise<void> {
  await getDb()
    .update(crmIntegrations)
    .set({
      ...(input.lastSyncAt !== undefined
        ? { lastSyncAt: input.lastSyncAt }
        : {}),
      ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
      updatedAt: new Date(),
    })
    .where(eq(crmIntegrations.id, integrationId));
}

export function serializeCrmIntegration(integration: CrmIntegration) {
  return {
    id: integration.id,
    provider: integration.provider,
    salesCrmBaseUrl: integration.salesCrmBaseUrl,
    campaignId: integration.campaignId,
    campaignName: integration.campaignName,
    syncEnabled: integration.syncEnabled,
    connected: isCrmIntegrationConnected(integration),
    connectedAt: integration.connectedAt?.toISOString() ?? null,
    lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
    lastError: integration.lastError,
  };
}

export function getInitialSalesCrmBaseUrl(
  integration: CrmIntegration | null,
): string {
  if (integration?.salesCrmBaseUrl) {
    return integration.salesCrmBaseUrl;
  }

  return getDefaultSalesCrmBaseUrl() ?? "";
}
