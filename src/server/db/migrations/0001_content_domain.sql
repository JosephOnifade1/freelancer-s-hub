CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postId" uuid NOT NULL,
	"parentId" uuid,
	"authorUid" uuid NOT NULL,
	"body" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"ups" integer DEFAULT 0 NOT NULL,
	"downs" integer DEFAULT 0 NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"isEdited" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_score_non_negative" CHECK ("comments"."score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pollId" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "poll_options_position_key" UNIQUE("pollId","position"),
	CONSTRAINT "poll_options_label_check" CHECK (length(btrim("poll_options"."label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pollId" uuid NOT NULL,
	"pollOptionId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_poll_user_key" UNIQUE("pollId","userId")
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "polls_post_key" UNIQUE("postId")
);
--> statement-breakpoint
CREATE TABLE "post_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postId" uuid NOT NULL,
	"uploaderUid" uuid NOT NULL,
	"storagePath" text NOT NULL,
	"fileName" text NOT NULL,
	"mimeType" text NOT NULL,
	"fileSize" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_attachments_storage_path_key" UNIQUE("storagePath"),
	CONSTRAINT "post_attachments_file_name_check" CHECK (length("post_attachments"."fileName") between 1 and 255),
	CONSTRAINT "post_attachments_mime_type_check" CHECK ("post_attachments"."mimeType" in (
        'application/pdf', 'text/plain', 'text/csv', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )),
	CONSTRAINT "post_attachments_file_size_check" CHECK ("post_attachments"."fileSize" between 1 and 10485760),
	CONSTRAINT "attachment_path_owned" CHECK (split_part("post_attachments"."storagePath", '/', 1) = "post_attachments"."uploaderUid"::text
          and split_part("post_attachments"."storagePath", '/', 2) = "post_attachments"."postId"::text)
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"type" text DEFAULT 'discussion' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"ups" integer DEFAULT 0 NOT NULL,
	"downs" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"commentCount" integer DEFAULT 0 NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"isEdited" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"authorUid" uuid NOT NULL,
	"communitySlug" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"allowComments" boolean DEFAULT true NOT NULL,
	"isPinned" boolean DEFAULT false NOT NULL,
	"externalLink" text,
	CONSTRAINT "posts_type_check" CHECK ("posts"."type" in ('discussion', 'question', 'resource', 'poll')),
	CONSTRAINT "posts_visibility_check" CHECK ("posts"."visibility" in ('public', 'members', 'admins')),
	CONSTRAINT "posts_score_non_negative" CHECK ("posts"."score" >= 0),
	CONSTRAINT "posts_views_non_negative" CHECK ("posts"."views" >= 0),
	CONSTRAINT "posts_comment_count_non_negative" CHECK ("posts"."commentCount" >= 0),
	CONSTRAINT "posts_restricted_requires_community" CHECK ("posts"."visibility" = 'public' or "posts"."communitySlug" is not null)
);
--> statement-breakpoint
CREATE TABLE "saved_posts" (
	"userId" uuid NOT NULL,
	"postId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_posts_userId_postId_pk" PRIMARY KEY("userId","postId")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"entityType" text NOT NULL,
	"entityId" uuid NOT NULL,
	"voteValue" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_identity_key" UNIQUE("userId","entityType","entityId"),
	CONSTRAINT "votes_entity_type_check" CHECK ("votes"."entityType" in ('post', 'comment')),
	CONSTRAINT "votes_value_check" CHECK ("votes"."voteValue" in (1, -1))
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_comments_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorUid_profiles_uid_fk" FOREIGN KEY ("authorUid") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_pollId_polls_id_fk" FOREIGN KEY ("pollId") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_polls_id_fk" FOREIGN KEY ("pollId") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollOptionId_poll_options_id_fk" FOREIGN KEY ("pollOptionId") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_userId_profiles_uid_fk" FOREIGN KEY ("userId") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_attachments" ADD CONSTRAINT "post_attachments_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_attachments" ADD CONSTRAINT "post_attachments_uploaderUid_profiles_uid_fk" FOREIGN KEY ("uploaderUid") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorUid_profiles_uid_fk" FOREIGN KEY ("authorUid") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_userId_profiles_uid_fk" FOREIGN KEY ("userId") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_profiles_uid_fk" FOREIGN KEY ("userId") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "comments" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("authorUid");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "poll_options_poll_idx" ON "poll_options" USING btree ("pollId");--> statement-breakpoint
CREATE INDEX "poll_votes_option_idx" ON "poll_votes" USING btree ("pollOptionId");--> statement-breakpoint
CREATE INDEX "post_attachments_post_idx" ON "post_attachments" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("authorUid");--> statement-breakpoint
CREATE INDEX "posts_community_idx" ON "posts" USING btree ("communitySlug");--> statement-breakpoint
CREATE INDEX "posts_visibility_created_idx" ON "posts" USING btree ("visibility","createdAt");--> statement-breakpoint
CREATE INDEX "saved_posts_post_idx" ON "saved_posts" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "votes_entity_idx" ON "votes" USING btree ("entityType","entityId");