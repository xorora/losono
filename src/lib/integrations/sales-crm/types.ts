export type SalesCrmTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export type SalesCrmApiErrorBody = {
  error?: string;
  message?: string;
};

export type SalesCrmCampaign = {
  id: string;
  name: string;
  status: string;
  campaignType: {
    id: string;
    name: string;
    slug: string;
  };
};

export type SalesCrmField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  isUnique: boolean;
  options?: unknown;
};

export type SalesCrmFieldValue = string | number | boolean | string[] | null;

export type SalesCrmCreateLeadInput = {
  campaignId: string;
  fieldValues: Record<string, SalesCrmFieldValue>;
  idempotencyKey?: string;
};

export type SalesCrmCreateLeadResult = {
  id: string;
  created: boolean;
};

export type SalesCrmBulkLeadInput = {
  fieldValues: Record<string, SalesCrmFieldValue>;
  idempotencyKey?: string;
};

export type SalesCrmBulkLeadResult = {
  idempotencyKey?: string;
  id?: string;
  status: "created" | "skipped" | "failed";
  error?: string;
};

export type SalesCrmBulkCreateLeadsResult = {
  imported: number;
  skipped: number;
  failed: number;
  results: SalesCrmBulkLeadResult[];
};
