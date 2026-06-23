ALTER TABLE "crm_integrations" ADD COLUMN "sales_crm_base_url" text;--> statement-breakpoint
ALTER TABLE "crm_integrations" ALTER COLUMN "access_token_encrypted" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_integrations" ALTER COLUMN "refresh_token_encrypted" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_integrations" ALTER COLUMN "token_expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_integrations" ALTER COLUMN "connected_at" DROP NOT NULL;
