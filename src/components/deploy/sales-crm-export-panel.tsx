"use client";

import { Link2, Link2Off, RefreshCw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SalesCrmCampaign,
  SalesCrmField,
} from "@/lib/integrations/sales-crm/types";
import type { PreChatField } from "@/lib/pre-chat-form";

type IntegrationSummary = {
  id: string;
  provider: string;
  salesCrmBaseUrl: string | null;
  campaignId: string | null;
  campaignName: string | null;
  syncEnabled: boolean;
  connected: boolean;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

type ExportStats = {
  total: number;
  exported: number;
  failed: number;
  skipped: number;
  pending: number;
};

type SalesCrmExportPanelProps = {
  agentId: string;
  preChatFields: PreChatField[];
  platformReady: boolean;
  defaultSalesCrmUrl: string | null;
  initialSalesCrmUrl: string;
  initialConnected: boolean;
  initialIntegration: IntegrationSummary | null;
  initialCampaigns: SalesCrmCampaign[];
  crmStatus?: string;
  crmError?: string;
};

const NONE_VALUE = "__none__";

export function SalesCrmExportPanel({
  agentId,
  preChatFields,
  platformReady,
  defaultSalesCrmUrl,
  initialSalesCrmUrl,
  initialConnected,
  initialIntegration,
  initialCampaigns,
  crmStatus,
  crmError,
}: SalesCrmExportPanelProps) {
  const router = useRouter();
  const [connected, setConnected] = useState(initialConnected);
  const [integration, setIntegration] = useState(initialIntegration);
  const [salesCrmUrl, setSalesCrmUrl] = useState(initialSalesCrmUrl);
  const [savingUrl, setSavingUrl] = useState(false);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    initialIntegration?.campaignId ?? "",
  );
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingReady, setMappingReady] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [crmFields, setCrmFields] = useState<SalesCrmField[]>([]);
  const [exportStats, setExportStats] = useState<ExportStats | null>(null);
  const [savingMapping, setSavingMapping] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (crmStatus === "connected") {
      toast.success("Connected to Sales CRM");
      router.replace(`/agents/${agentId}/forms`, { scroll: false });
    }
  }, [crmStatus, agentId, router]);

  const loadFieldMapping = useCallback(async () => {
    if (!integration?.campaignId) {
      return;
    }

    setMappingLoading(true);

    try {
      const response = await fetch(
        `/api/integrations/sales-crm/field-mapping?agentId=${agentId}`,
      );
      const data = (await response.json()) as {
        mapping?: Record<string, string>;
        crmFields?: SalesCrmField[];
        ready?: boolean;
        exportStats?: ExportStats;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load field mapping");
      }

      setFieldMapping(data.mapping ?? {});
      setCrmFields(data.crmFields ?? []);
      setMappingReady(Boolean(data.ready));
      setExportStats(data.exportStats ?? null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load field mapping",
      );
    } finally {
      setMappingLoading(false);
    }
  }, [agentId, integration?.campaignId]);

  useEffect(() => {
    if (connected && integration?.campaignId) {
      void loadFieldMapping();
    }
  }, [connected, integration?.campaignId, loadFieldMapping]);

  async function refreshIntegration() {
    const response = await fetch("/api/integrations/sales-crm");
    const data = (await response.json()) as {
      connected?: boolean;
      integration?: IntegrationSummary | null;
      campaigns?: SalesCrmCampaign[];
      campaignsError?: string;
    };

    setConnected(Boolean(data.connected));
    setIntegration(data.integration ?? null);
    setCampaigns(data.campaigns ?? []);
    setCampaignsError(data.campaignsError ?? null);
    setSelectedCampaignId(data.integration?.campaignId ?? "");
  }

  async function saveCampaign() {
    if (!selectedCampaignId) {
      toast.error("Select a campaign");
      return;
    }

    setSavingCampaign(true);

    try {
      const response = await fetch("/api/integrations/sales-crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaignId }),
      });
      const data = (await response.json()) as {
        integration?: IntegrationSummary;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save campaign");
      }

      setIntegration(data.integration ?? null);
      toast.success("Campaign saved");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save campaign",
      );
    } finally {
      setSavingCampaign(false);
    }
  }

  async function applySuggestedMapping() {
    setMappingLoading(true);

    try {
      const response = await fetch(
        `/api/integrations/sales-crm/field-mapping?agentId=${agentId}`,
      );
      const data = (await response.json()) as {
        suggestedMapping?: Record<string, string>;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load suggestions");
      }

      setFieldMapping(data.suggestedMapping ?? {});
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load suggestions",
      );
    } finally {
      setMappingLoading(false);
    }
  }

  async function saveMapping() {
    setSavingMapping(true);

    try {
      const response = await fetch(
        `/api/integrations/sales-crm/field-mapping?agentId=${agentId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mapping: fieldMapping }),
        },
      );
      const data = (await response.json()) as {
        ready?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save field mapping");
      }

      setMappingReady(Boolean(data.ready));
      toast.success("Field mapping saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save field mapping",
      );
    } finally {
      setSavingMapping(false);
    }
  }

  async function exportAllLeads() {
    setExporting(true);

    try {
      const response = await fetch(
        `/api/integrations/sales-crm/export?agentId=${agentId}`,
        { method: "POST" },
      );
      const data = (await response.json()) as {
        imported?: number;
        skipped?: number;
        failed?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Export failed");
      }

      toast.success(
        `Export complete: ${data.imported ?? 0} imported, ${data.skipped ?? 0} skipped, ${data.failed ?? 0} failed`,
      );

      await Promise.all([loadFieldMapping(), refreshIntegration()]);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function retryFailedExports() {
    setRetrying(true);

    try {
      const response = await fetch(
        `/api/integrations/sales-crm/retry?agentId=${agentId}`,
        { method: "POST" },
      );
      const data = (await response.json()) as {
        imported?: number;
        skipped?: number;
        failed?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Retry failed");
      }

      toast.success(
        `Retry complete: ${data.imported ?? 0} imported, ${data.skipped ?? 0} skipped, ${data.failed ?? 0} still failed`,
      );

      await Promise.all([loadFieldMapping(), refreshIntegration()]);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);

    try {
      const response = await fetch("/api/integrations/sales-crm", {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("Failed to disconnect");
        return;
      }

      setConnected(false);
      setIntegration(null);
      setCampaigns([]);
      setFieldMapping({});
      setCrmFields([]);
      setExportStats(null);
      setMappingReady(false);
      setDisconnectOpen(false);
      toast.success("Disconnected from Sales CRM");
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  function updateFieldMapping(fieldId: string, crmKey: string) {
    setFieldMapping((current) => {
      const next = { ...current };

      if (crmKey === NONE_VALUE) {
        delete next[fieldId];
      } else {
        next[fieldId] = crmKey;
      }

      return next;
    });
  }

  async function saveSalesCrmUrl() {
    if (!salesCrmUrl.trim()) {
      toast.error("Enter your Sales CRM URL");
      return;
    }

    setSavingUrl(true);

    try {
      const response = await fetch("/api/integrations/sales-crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesCrmBaseUrl: salesCrmUrl }),
      });
      const data = (await response.json()) as {
        integration?: IntegrationSummary;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save Sales CRM URL");
      }

      setIntegration(data.integration ?? null);
      toast.success("Sales CRM URL saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save Sales CRM URL",
      );
    } finally {
      setSavingUrl(false);
    }
  }

  function getConnectHref(): string {
    const params = new URLSearchParams({ agentId });
    const url = salesCrmUrl.trim() || defaultSalesCrmUrl || "";

    if (url) {
      params.set("salesCrmBaseUrl", url);
    }

    return `/api/integrations/sales-crm/connect?${params.toString()}`;
  }

  const canConnect =
    platformReady && Boolean(salesCrmUrl.trim() || defaultSalesCrmUrl);

  if (!platformReady) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">Sales CRM export</h2>
          <p className="text-sm text-muted-foreground">
            Sales CRM export is temporarily unavailable. Contact your Losono
            administrator.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">Sales CRM export</h2>
          <p className="text-sm text-muted-foreground">
            Connect Sales CRM to export pre-chat leads into a campaign. New
            submissions sync automatically when mapping is complete.
          </p>
        </div>

        {connected && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDisconnectOpen(true)}
          >
            <Link2Off />
            Disconnect
          </Button>
        )}
      </div>

      {crmError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Connection failed: {crmError}
        </p>
      )}

      {!connected ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Sales CRM URL</p>
            <p className="text-sm text-muted-foreground">
              Enter the URL where your team signs in to Sales CRM, then connect
              your account.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                value={salesCrmUrl}
                onChange={(event) => setSalesCrmUrl(event.target.value)}
                placeholder={
                  defaultSalesCrmUrl ?? "https://crm.yourcompany.com"
                }
                className="min-w-[240px] flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={savingUrl}
                onClick={() => void saveSalesCrmUrl()}
              >
                {savingUrl ? "Saving…" : "Save URL"}
              </Button>
            </div>
            {defaultSalesCrmUrl ? (
              <p className="text-xs text-muted-foreground">
                Your workspace default is {defaultSalesCrmUrl}.
              </p>
            ) : null}
          </div>

          <Button asChild disabled={!canConnect}>
            <a href={getConnectHref()}>
              <Link2 />
              Connect to Sales CRM
            </a>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
            <p className="font-medium">Connection status</p>
            <p className="mt-1 text-muted-foreground">
              {integration?.salesCrmBaseUrl
                ? `${integration.salesCrmBaseUrl} · `
                : ""}
              Connected since{" "}
              {integration?.connectedAt
                ? new Date(integration.connectedAt).toLocaleString()
                : "—"}
              {integration?.lastSyncAt
                ? ` · Last export ${new Date(integration.lastSyncAt).toLocaleString()}`
                : ""}
            </p>
            {integration?.lastError && (
              <p className="mt-2 text-destructive">{integration.lastError}</p>
            )}
            {campaignsError && (
              <p className="mt-2 text-destructive">{campaignsError}</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Target campaign</p>
              <p className="text-sm text-muted-foreground">
                Choose the Sales CRM campaign where leads from this account
                should be created.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <Select
                value={selectedCampaignId || undefined}
                onValueChange={setSelectedCampaignId}
              >
                <SelectTrigger className="min-w-[240px] flex-1">
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                      {campaign.campaignType?.name
                        ? ` · ${campaign.campaignType.name}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={saveCampaign}
                disabled={savingCampaign || !selectedCampaignId}
              >
                Save campaign
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void refreshIntegration()}
                aria-label="Refresh campaigns"
              >
                <RefreshCw />
              </Button>
            </div>
          </div>

          {integration?.campaignId && (
            <>
              {preChatFields.length === 0 ? (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
                  Add pre-chat form fields above before mapping exports.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Field mapping</p>
                      <p className="text-sm text-muted-foreground">
                        Map each pre-chat field to a Sales CRM campaign field
                        for agent{" "}
                        <span className="font-medium">
                          {integration.campaignName ?? "selected campaign"}
                        </span>
                        .
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void applySuggestedMapping()}
                      disabled={mappingLoading}
                    >
                      Auto-suggest
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left">
                        <tr>
                          <th className="px-4 py-2 font-medium">
                            Pre-chat field
                          </th>
                          <th className="px-4 py-2 font-medium">
                            Sales CRM field
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {preChatFields.map((field) => (
                          <tr key={field.id}>
                            <td className="px-4 py-3 align-top">
                              <p className="font-medium">{field.label}</p>
                              <p className="text-muted-foreground capitalize">
                                {field.type}
                                {field.required ? " · required" : ""}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <Select
                                value={fieldMapping[field.id] ?? NONE_VALUE}
                                onValueChange={(value) =>
                                  updateFieldMapping(field.id, value)
                                }
                                disabled={mappingLoading}
                              >
                                <SelectTrigger className="w-full min-w-[200px]">
                                  <SelectValue placeholder="Not mapped" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NONE_VALUE}>
                                    Not mapped
                                  </SelectItem>
                                  {crmFields.map((crmField) => (
                                    <SelectItem
                                      key={crmField.key}
                                      value={crmField.key}
                                    >
                                      {crmField.label} ({crmField.type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void saveMapping()}
                      disabled={savingMapping || mappingLoading}
                    >
                      Save mapping
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3 border-t border-border pt-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Bulk export</p>
                  <p className="text-sm text-muted-foreground">
                    Export existing submissions that have not been synced yet.
                    Duplicates are skipped using the submission ID.
                  </p>
                </div>

                {exportStats && (
                  <p className="text-sm text-muted-foreground">
                    {exportStats.exported} of {exportStats.total} exported
                    {exportStats.pending > 0
                      ? ` · ${exportStats.pending} pending`
                      : ""}
                    {exportStats.failed > 0
                      ? ` · ${exportStats.failed} failed`
                      : ""}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void exportAllLeads()}
                    disabled={
                      exporting ||
                      retrying ||
                      mappingLoading ||
                      !mappingReady ||
                      preChatFields.length === 0
                    }
                  >
                    <Upload />
                    {exporting ? "Exporting…" : "Export all leads"}
                  </Button>

                  {exportStats && exportStats.failed > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void retryFailedExports()}
                      disabled={
                        exporting ||
                        retrying ||
                        mappingLoading ||
                        !mappingReady ||
                        preChatFields.length === 0
                      }
                    >
                      <RefreshCw />
                      {retrying
                        ? "Retrying…"
                        : `Retry failed (${exportStats.failed})`}
                    </Button>
                  )}
                </div>

                {!mappingReady && preChatFields.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Save field mapping before exporting.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect Sales CRM?"
        description="Auto-sync will stop and you'll need to reconnect to export leads again."
        confirmLabel={disconnecting ? "Disconnecting…" : "Disconnect"}
        onConfirm={disconnect}
        loading={disconnecting}
      />
    </section>
  );
}
