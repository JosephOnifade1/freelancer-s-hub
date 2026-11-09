-- Borynx achievements & badges system.
-- Apply AFTER supabase_reports_and_moderation_migration.sql (profiles.role exists)
-- and BEFORE deploying the accompanying frontend. Transactional: a failed
-- change rolls back the whole migration.
begin;

-- ─── Badge catalog ─────────────────────────────────────────────────────────
create table if not exists public.badges (
  "id" text primary key check (length(trim("id")) between 1 and 60),
  "name" text not null check (length(trim("name")) between 1 and 100),
  "description" text not null check (length(trim("description")) between 1 and 300),
  "icon" text not null default 'award', -- lucide icon name
  "category" text not null default 'community'
    check ("category" in ('publishing', 'helping', 'community', 'trust', 'longevity')),
  "target" integer not null default 1 check ("target" > 0),
  "rarity" text not null default 'common'
    check ("rarity" in ('common', 'uncommon', 'rare', 'legendary')),
  "createdAt" timestamptz not null default now()
);

alter table public.badges enable row level security;
grant select on public.badges to anon, authenticated;

drop policy if exists "Anyone can read badges" on public.badges;
create policy "Anyone can read badges" on public.badges
  for select to anon, authenticated using (true);

-- ─── User earned badges ────────────────────────────────────────────────────
create table if not exists public.user_badges (
  "id" uuid primary key default gen_random_uuid(),
  "userUid" uuid not null references public.profiles("uid") on delete cascade,
  "badgeId" text not null references public.badges("id") on delete cascade,
  "earnedAt" timestamptz not null default now(),
  unique ("userUid", "badgeId")
);

create index if not exists idx_user_badges_user
  on public.user_badges ("userUid", "earnedAt" desc);
create index if not exists idx_user_badges_badge
  on public.user_badges ("badgeId");

alter table public.user_badges enable row level security;
grant select on public.user_badges to anon, authenticated;
grant insert on public.user_badges to authenticated;

drop policy if exists "Anyone can read earned badges" on public.user_badges;
create policy "Anyone can read earned badges" on public.user_badges
  for select to anon, authenticated using (true);

drop policy if exists "System can award badges" on public.user_badges;
create policy "System can award badges" on public.user_badges
  for insert to authenticated with check (true);

-- ─── Seed badge catalog ────────────────────────────────────────────────────
insert into public.badges ("id", "name", "description", "icon", "category", "target", "rarity") values
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

commit;

-- After applying, frontend code in src/lib/badges.ts reads from these tables.
-- Until the migration is applied, Achievements.tsx falls back to client-side
-- computation (existing behaviour).
