CREATE TABLE "lead_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leadId" uuid NOT NULL,
	"applicantUid" uuid NOT NULL,
	"proposal" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_lead_applicant_unique" UNIQUE("leadId","applicantUid"),
	CONSTRAINT "applications_status_check" CHECK ("lead_applications"."status" in ('pending','accepted','rejected','withdrawn')),
	CONSTRAINT "applications_proposal_check" CHECK (length(trim("lead_applications"."proposal")) between 1 and 20000)
);
--> statement-breakpoint
CREATE TABLE "lead_pipeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userUid" uuid NOT NULL,
	"leadId" uuid,
	"clientName" text NOT NULL,
	"title" text NOT NULL,
	"budget" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'Manual' NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_user_lead_unique" UNIQUE("userUid","leadId"),
	CONSTRAINT "pipeline_stage_check" CHECK ("lead_pipeline"."stage" in ('new','conversation','proposal','negotiation','won')),
	CONSTRAINT "pipeline_client_check" CHECK (length(trim("lead_pipeline"."clientName")) between 1 and 120),
	CONSTRAINT "pipeline_title_check" CHECK (length(trim("lead_pipeline"."title")) between 1 and 180),
	CONSTRAINT "pipeline_budget_check" CHECK (length("lead_pipeline"."budget") <= 80),
	CONSTRAINT "pipeline_source_check" CHECK (length("lead_pipeline"."source") <= 80)
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"budget" text NOT NULL,
	"currency" text NOT NULL,
	"location" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"postedByUid" uuid NOT NULL,
	"postedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"applicantsCount" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "leads_type_check" CHECK ("leads"."type" in ('Bounty','Project','Retainer','Full-time')),
	CONSTRAINT "leads_status_check" CHECK ("leads"."status" in ('open','in-progress','closed')),
	CONSTRAINT "leads_count_check" CHECK ("leads"."applicantsCount" >= 0),
	CONSTRAINT "leads_title_check" CHECK (length(trim("leads"."title")) between 1 and 180),
	CONSTRAINT "leads_description_check" CHECK (length(trim("leads"."description")) between 1 and 10000)
);
--> statement-breakpoint
ALTER TABLE "lead_applications" ADD CONSTRAINT "lead_applications_leadId_leads_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_applications" ADD CONSTRAINT "lead_applications_applicantUid_profiles_uid_fk" FOREIGN KEY ("applicantUid") REFERENCES "public"."profiles"("uid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_pipeline" ADD CONSTRAINT "lead_pipeline_userUid_profiles_uid_fk" FOREIGN KEY ("userUid") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_pipeline" ADD CONSTRAINT "lead_pipeline_leadId_leads_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_postedByUid_profiles_uid_fk" FOREIGN KEY ("postedByUid") REFERENCES "public"."profiles"("uid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_applicant_created_idx" ON "lead_applications" USING btree ("applicantUid","createdAt");--> statement-breakpoint
CREATE INDEX "applications_lead_created_idx" ON "lead_applications" USING btree ("leadId","createdAt");--> statement-breakpoint
CREATE INDEX "pipeline_user_updated_idx" ON "lead_pipeline" USING btree ("userUid","updatedAt");--> statement-breakpoint
CREATE INDEX "leads_owner_idx" ON "leads" USING btree ("postedByUid");--> statement-breakpoint
CREATE INDEX "leads_posted_idx" ON "leads" USING btree ("postedAt","id");--> statement-breakpoint
CREATE INDEX "leads_status_type_idx" ON "leads" USING btree ("status","type");