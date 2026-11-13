CREATE TABLE "profiles" (
	"uid" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"displayName" text,
	"initial" text,
	"bio" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Available' NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"reputation" integer DEFAULT 0 NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"following" integer DEFAULT 0 NOT NULL,
	"avatarUrl" text,
	"isVerifiedPro" boolean DEFAULT false NOT NULL,
	"hasSeenVeteranCelebration" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_role_check" CHECK ("profiles"."role" in ('admin', 'moderator', 'member')),
	CONSTRAINT "profiles_status_check" CHECK ("profiles"."status" in ('Available', 'Busy')),
	CONSTRAINT "profiles_username_lowercase_check" CHECK ("profiles"."username" = lower("profiles"."username")),
	CONSTRAINT "profiles_username_format_check" CHECK ("profiles"."username" ~ '^[a-z0-9_]{3,15}$'),
	CONSTRAINT "profiles_reputation_non_negative" CHECK ("profiles"."reputation" >= 0),
	CONSTRAINT "profiles_followers_non_negative" CHECK ("profiles"."followers" >= 0),
	CONSTRAINT "profiles_following_non_negative" CHECK ("profiles"."following" >= 0)
);
--> statement-breakpoint
CREATE TABLE "usernames" (
	"username" text PRIMARY KEY NOT NULL,
	"uid" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usernames_username_lowercase_check" CHECK ("usernames"."username" = lower("usernames"."username")),
	CONSTRAINT "usernames_username_format_check" CHECK ("usernames"."username" ~ '^[a-z0-9_]{3,15}$')
);
--> statement-breakpoint
ALTER TABLE "usernames" ADD CONSTRAINT "usernames_uid_profiles_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."profiles"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "profiles_role_idx" ON "profiles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "profiles_reputation_idx" ON "profiles" USING btree ("reputation");--> statement-breakpoint
CREATE UNIQUE INDEX "usernames_uid_key" ON "usernames" USING btree ("uid");