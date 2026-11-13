-- Existing community-scoped rows cannot be mapped without the external community
-- records. Never silently detach them. Disposable development databases may be
-- cleared explicitly by their operator; populated deployments need an explicit
-- import of real communities before this migration, not fabricated placeholders.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM posts WHERE "communitySlug" IS NOT NULL) THEN
    RAISE EXCEPTION 'Phase 2E requires explicit disposition of legacy community-scoped posts before migration';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text,
	"category" text DEFAULT 'Other' NOT NULL,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"ownerId" text DEFAULT 'system' NOT NULL,
	"memberCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communities_slug_unique" UNIQUE("slug"),
	CONSTRAINT "communities_slug_check" CHECK ("communities"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("communities"."slug") <= 100),
	CONSTRAINT "communities_owner_check" CHECK ("communities"."ownerId" = 'system' or "communities"."ownerId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
	CONSTRAINT "communities_count_check" CHECK ("communities"."memberCount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"userId" uuid NOT NULL,
	"communityId" uuid NOT NULL,
	CONSTRAINT "community_members_userId_communityId_pk" PRIMARY KEY("userId","communityId")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"followerId" uuid NOT NULL,
	"followingId" uuid NOT NULL,
	CONSTRAINT "follows_followerId_followingId_pk" PRIMARY KEY("followerId","followingId"),
	CONSTRAINT "follows_not_self" CHECK ("follows"."followerId" <> "follows"."followingId")
);
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_restricted_requires_community";--> statement-breakpoint
DROP INDEX "posts_community_idx";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "communityId" uuid;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_userId_profiles_uid_fk" FOREIGN KEY ("userId") REFERENCES "public"."profiles"("uid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_communityId_communities_id_fk" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_profiles_uid_fk" FOREIGN KEY ("followerId") REFERENCES "public"."profiles"("uid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingId_profiles_uid_fk" FOREIGN KEY ("followingId") REFERENCES "public"."profiles"("uid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communities_owner_idx" ON "communities" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "communities_count_idx" ON "communities" USING btree ("memberCount");--> statement-breakpoint
CREATE INDEX "community_members_community_idx" ON "community_members" USING btree ("communityId");--> statement-breakpoint
CREATE INDEX "follows_following_idx" ON "follows" USING btree ("followingId");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_communityId_communities_id_fk" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_community_idx" ON "posts" USING btree ("communityId");--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "communitySlug";--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_restricted_requires_community" CHECK ("posts"."visibility" = 'public' or "posts"."communityId" is not null);
--> statement-breakpoint
-- Relationships are intentionally not backfilled (disposable legacy test data).
-- The newly-created follows table is empty, so its derived counts must be zero.
UPDATE profiles SET followers=0, following=0;
