CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"responses" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_submissions_agent_id_idx" ON "form_submissions" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_submissions_agent_visitor_idx" ON "form_submissions" USING btree ("agent_id","visitor_id");