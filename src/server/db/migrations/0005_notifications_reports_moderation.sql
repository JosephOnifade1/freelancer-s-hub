CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"actorUid" uuid,
	"type" text NOT NULL,
	"entityId" uuid,
	"contextId" uuid,
	"message" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"eventKey" text NOT NULL,
	CONSTRAINT "notifications_event_recipient_unique" UNIQUE("eventKey","userId"),
	CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" in ('comment','reply','upvote','follow','application_received','application_accepted','application_rejected','application_withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporterUid" uuid NOT NULL,
	"entityType" text NOT NULL,
	"entityId" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolvedBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_entity_check" CHECK ("reports"."entityType" in ('post','comment','lead','profile')),
	CONSTRAINT "reports_reason_check" CHECK ("reports"."reason" in ('spam','harassment','scam','inappropriate','hate_speech','misinformation','copyright','nsfw','other')),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" in ('open','resolved','dismissed')),
	CONSTRAINT "reports_details_check" CHECK (length("reports"."details") <= 10000)
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_profiles_uid_fk" FOREIGN KEY ("userId") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorUid_profiles_uid_fk" FOREIGN KEY ("actorUid") REFERENCES "public"."profiles"("uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterUid_profiles_uid_fk" FOREIGN KEY ("reporterUid") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolvedBy_profiles_uid_fk" FOREIGN KEY ("resolvedBy") REFERENCES "public"."profiles"("uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("userId","createdAt","id");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("userId") WHERE "notifications"."isRead"=false;--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","createdAt","id");--> statement-breakpoint
CREATE INDEX "reports_reporter_created_idx" ON "reports" USING btree ("reporterUid","createdAt");