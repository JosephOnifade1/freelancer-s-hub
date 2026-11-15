-- Additive security correction; legacy unsafe pointers are preserved but fail closed in helpers.
CREATE TABLE "development_seed_identities" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"purpose" text NOT NULL,
	"owner" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "development_seed_identities_email_unique" UNIQUE("email"),
	CONSTRAINT "development_seed_identities_purpose_unique" UNIQUE("purpose")
);
--> statement-breakpoint
CREATE TABLE "document_uploads" (
	"path" text PRIMARY KEY NOT NULL,
	"attachment_id" uuid,
	"actor" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"bucket" text DEFAULT 'post-documents' NOT NULL,
	"size" integer NOT NULL,
	"mime" text NOT NULL,
	"state" text DEFAULT 'uploading' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_uploads_attachment_id_unique" UNIQUE("attachment_id"),
	CONSTRAINT "document_upload_key" CHECK ("document_uploads"."path" ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(pdf|txt|csv|doc|docx|xlsx)$' and split_part("document_uploads"."path",'/',1)="document_uploads"."actor"::text and split_part("document_uploads"."path",'/',2)="document_uploads"."post_id"::text),
	CONSTRAINT "document_upload_bucket" CHECK ("document_uploads"."bucket" = 'post-documents'),
	CONSTRAINT "document_upload_state" CHECK ("document_uploads"."state" in ('uploading','ready','registered','delete_pending','deleted')),
	CONSTRAINT "document_upload_size" CHECK ("document_uploads"."size" between 1 and 10485760)
);
--> statement-breakpoint
ALTER TABLE "development_seed_identities" ADD CONSTRAINT "development_seed_identities_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_actor_profiles_uid_fk" FOREIGN KEY ("actor") REFERENCES "public"."profiles"("uid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_attachments" ADD CONSTRAINT "attachment_canonical_key" CHECK ("post_attachments"."storagePath" ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(pdf|txt|csv|doc|docx|xlsx)$') NOT VALID;
