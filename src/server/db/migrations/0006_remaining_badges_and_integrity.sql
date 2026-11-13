CREATE TABLE "badges" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'award' NOT NULL,
	"category" text DEFAULT 'community' NOT NULL,
	"target" integer DEFAULT 1 NOT NULL,
	"rarity" text DEFAULT 'common' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badges_id_check" CHECK (length(trim("badges"."id")) between 1 and 60),
	CONSTRAINT "badges_name_check" CHECK (length(trim("badges"."name")) between 1 and 100),
	CONSTRAINT "badges_description_check" CHECK (length(trim("badges"."description")) between 1 and 300),
	CONSTRAINT "badges_category_check" CHECK ("badges"."category" in ('publishing','helping','community','trust','longevity')),
	CONSTRAINT "badges_target_check" CHECK ("badges"."target">0),
	CONSTRAINT "badges_rarity_check" CHECK ("badges"."rarity" in ('common','uncommon','rare','legendary'))
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userUid" uuid NOT NULL,
	"badgeId" text NOT NULL,
	"earnedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_badges_user_badge_unique" UNIQUE("userUid","badgeId")
);
--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userUid_profiles_uid_fk" FOREIGN KEY ("userUid") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badgeId_badges_id_fk" FOREIGN KEY ("badgeId") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_badges_user_earned_idx" ON "user_badges" USING btree ("userUid","earnedAt");--> statement-breakpoint
CREATE INDEX "user_badges_badge_idx" ON "user_badges" USING btree ("badgeId");--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_id_poll_unique" UNIQUE("id","pollId");--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_poll_fk" FOREIGN KEY ("pollOptionId","pollId") REFERENCES "public"."poll_options"("id","pollId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_vote_counters_check" CHECK ("comments"."ups" >= 0 and "comments"."downs" >= 0 and "comments"."score" = "comments"."ups" - "comments"."downs");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_vote_counters_check" CHECK ("posts"."ups" >= 0 and "posts"."downs" >= 0 and "posts"."score" = "posts"."ups" - "posts"."downs");
--> statement-breakpoint
insert into badges ("id", "name", "description", "icon", "category", "target", "rarity") values
  ('first-post', 'First Post', 'Publish your first post.', 'Flame', 'publishing', 1, 'common'),
  ('rising-voice', 'Rising Voice', 'Reach 100 reputation.', 'Zap', 'trust', 100, 'common'),
  ('helper', 'Helper', 'Get 10 upvotes on your comments.', 'Heart', 'helping', 10, 'common'),
  ('trusted-voice', 'Trusted Voice', 'Reach 1,000 reputation.', 'Star', 'trust', 1000, 'rare'),
  ('consistent', 'Consistent', 'Post or comment 30 days in a row.', 'Calendar', 'longevity', 30, 'rare'),
  ('generous', 'Generous', 'Share 5 resource posts.', 'BookOpen', 'publishing', 5, 'uncommon'),
  ('veteran', 'Veteran Freelancer', 'Reach 5,000 reputation.', 'Trophy', 'trust', 5000, 'legendary'),
  ('convo-starter', 'Conversation Starter', 'Get 50 comments on a single post.', 'MessageSquare', 'helping', 50, 'uncommon')
on conflict ("id") do update set
  "name" = excluded."name",
  "description" = excluded."description",
  "icon" = excluded."icon",
  "category" = excluded."category",
  "target" = excluded."target",
  "rarity" = excluded."rarity";
