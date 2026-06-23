CREATE TABLE "crm_export_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"crm_lead_id" text,
	"status" text NOT NULL,
	"error" text,
	"exported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_field_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"campaign_id" text,
	"campaign_name" text,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_export_log" ADD CONSTRAINT "crm_export_log_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_export_log" ADD CONSTRAINT "crm_export_log_integration_id_crm_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."crm_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_export_log" ADD CONSTRAINT "crm_export_log_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_field_mappings" ADD CONSTRAINT "crm_field_mappings_integration_id_crm_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."crm_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_field_mappings" ADD CONSTRAINT "crm_field_mappings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_integrations" ADD CONSTRAINT "crm_integrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_export_log_submission_integration_idx" ON "crm_export_log" USING btree ("submission_id","integration_id");--> statement-breakpoint
CREATE INDEX "crm_export_log_integration_id_idx" ON "crm_export_log" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "crm_export_log_agent_id_idx" ON "crm_export_log" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "crm_export_log_status_idx" ON "crm_export_log" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_field_mappings_integration_agent_idx" ON "crm_field_mappings" USING btree ("integration_id","agent_id");--> statement-breakpoint
CREATE INDEX "crm_field_mappings_agent_id_idx" ON "crm_field_mappings" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_integrations_user_provider_idx" ON "crm_integrations" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "crm_integrations_user_id_idx" ON "crm_integrations" USING btree ("user_id");