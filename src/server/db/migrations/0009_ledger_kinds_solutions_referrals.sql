-- =============================================================================
-- Migration 0009: Ledger reputation, post kinds, solution tracking,
--                 moderation actions, referral attributions
-- =============================================================================
-- ADDITIVE ONLY — no DROP TABLE, no DROP COLUMN, no breaking changes.
-- All existing rows get sensible defaults; no backfill required.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Post kind column (extends existing `type` column with new taxonomy)
-- ---------------------------------------------------------------------------
-- `kind` is a separate dimension from `type` (which controls UI rendering of
-- polls etc.). `kind` describes the editorial intent: discussion, resource,
-- help request, or showcase. Defaults to 'discussion' for all existing posts.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'discussion';

ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_kind_check;

ALTER TABLE posts
  ADD CONSTRAINT posts_kind_check
    CHECK (kind IN ('discussion', 'resource', 'help', 'showcase'));

-- ---------------------------------------------------------------------------
-- 2. Post solution tracking (for help-kind posts)
-- ---------------------------------------------------------------------------
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS "isSolved" boolean NOT NULL DEFAULT false;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS "solutionCommentId" uuid
    REFERENCES comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_solved_idx
  ON posts ("isSolved")
  WHERE "isSolved" = true;

-- ---------------------------------------------------------------------------
-- 3. karma_events — append-only reputation ledger
-- ---------------------------------------------------------------------------
-- Every reputation-affecting action writes a row here.
-- `castVote` must continue using pg_advisory_xact_lock and write karma_events
-- inside the same transaction for consistency.
-- Never DELETE or UPDATE rows — emit a compensating negative event instead.

CREATE TABLE IF NOT EXISTS karma_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "profileUid" uuid       NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  delta       integer     NOT NULL,     -- positive = gain, negative = loss
  reason      text        NOT NULL,     -- e.g. 'post_upvoted', 'comment_accepted_solution'
  "entityType" text,                   -- 'post' | 'comment' | NULL
  "entityId"  uuid,                    -- the post or comment that triggered this
  "actorUid"  uuid        REFERENCES profiles(uid) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT karma_events_reason_check
    CHECK (reason IN (
      'post_upvoted',
      'post_downvoted',
      'comment_upvoted',
      'comment_downvoted',
      'solution_accepted',
      'solution_given',
      'post_created',
      'post_removed_by_mod',
      'comment_removed_by_mod',
      'referral_joined',
      'manual_adjustment'
    ))
);

CREATE INDEX IF NOT EXISTS karma_events_profile_created_idx
  ON karma_events ("profileUid", "createdAt" DESC, id);

CREATE INDEX IF NOT EXISTS karma_events_entity_idx
  ON karma_events ("entityType", "entityId")
  WHERE "entityId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. moderation_actions — structured audit log for all mod decisions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moderation_actions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "moderatorUid" uuid       NOT NULL REFERENCES profiles(uid) ON DELETE SET NULL,
  "entityType"  text        NOT NULL,  -- 'post' | 'comment' | 'profile' | 'lead'
  "entityId"    uuid        NOT NULL,
  action        text        NOT NULL,  -- e.g. 'remove', 'restore', 'ban', 'warn', 'pin'
  reason        text        NOT NULL DEFAULT '',
  "resolvedReportId" uuid   REFERENCES reports(id) ON DELETE SET NULL,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mod_actions_entity_check
    CHECK ("entityType" IN ('post', 'comment', 'profile', 'lead')),

  CONSTRAINT mod_actions_action_check
    CHECK (action IN (
      'remove',
      'restore',
      'ban',
      'unban',
      'warn',
      'pin',
      'unpin',
      'lock',
      'unlock',
      'mark_spam',
      'mark_nsfw'
    ))
);

CREATE INDEX IF NOT EXISTS mod_actions_entity_idx
  ON moderation_actions ("entityType", "entityId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS mod_actions_moderator_idx
  ON moderation_actions ("moderatorUid", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- 5. referral_attributions — track referral join attribution
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_attributions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "referrerUid" uuid        NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  "refereeUid"  uuid        NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  "referralCode" text       NOT NULL,
  "joinedAt"    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT referral_unique_referee UNIQUE ("refereeUid")
);

CREATE INDEX IF NOT EXISTS referral_referrer_idx
  ON referral_attributions ("referrerUid", "joinedAt" DESC);
