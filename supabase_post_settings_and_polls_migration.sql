-- ============================================================
-- BORYNX — Post Settings + Polls Migration
-- Run this once in the Supabase SQL Editor. Safe to re-run
-- (uses IF NOT EXISTS / DROP POLICY IF EXISTS throughout).
-- ============================================================

-- 1. New columns on posts (visibility, allow comments, pin, link)
alter table public.posts add column if not exists "visibility" text default 'public';
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check ("visibility" in ('public', 'members', 'admins'));
alter table public.posts add column if not exists "allowComments" boolean default true;
alter table public.posts add column if not exists "isPinned" boolean default false;
alter table public.posts add column if not exists "externalLink" text;

update public.posts set "visibility" = 'public' where "visibility" is null;
update public.posts set "allowComments" = true where "allowComments" is null;
update public.posts set "isPinned" = false where "isPinned" is null;


-- 2. Polls tables
create table if not exists public.polls (
  "id" uuid primary key default gen_random_uuid(),
  "postId" uuid not null references public.posts("id") on delete cascade,
  "createdAt" timestamptz default now()
);

create table if not exists public.poll_options (
  "id" uuid primary key default gen_random_uuid(),
  "pollId" uuid not null references public.polls("id") on delete cascade,
  "label" text not null,
  "position" integer default 0
);

create table if not exists public.poll_votes (
  "id" uuid primary key default gen_random_uuid(),
  "pollId" uuid not null references public.polls("id") on delete cascade,
  "pollOptionId" uuid not null references public.poll_options("id") on delete cascade,
  "userId" uuid not null references public.profiles("uid") on delete cascade,
  "createdAt" timestamptz default now(),
  unique ("pollId", "userId")
);


-- 3. RLS for polls
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "Public read polls" on public.polls;
create policy "Public read polls" on public.polls for select using (true);
drop policy if exists "Post author can create poll" on public.polls;
create policy "Post author can create poll" on public.polls for insert with check (
  exists (select 1 from public.posts where posts."id" = "postId" and posts."authorUid" = auth.uid())
);

drop policy if exists "Public read poll options" on public.poll_options;
create policy "Public read poll options" on public.poll_options for select using (true);
drop policy if exists "Post author can create poll options" on public.poll_options;
create policy "Post author can create poll options" on public.poll_options for insert with check (
  exists (
    select 1 from public.polls
    join public.posts on posts."id" = polls."postId"
    where polls."id" = "pollId" and posts."authorUid" = auth.uid()
  )
);

drop policy if exists "Public read poll votes" on public.poll_votes;
create policy "Public read poll votes" on public.poll_votes for select using (true);
drop policy if exists "Auth users can vote once per poll" on public.poll_votes;
create policy "Auth users can vote once per poll" on public.poll_votes for insert with check (auth.uid() = "userId");
