-- ==========================================
-- BORYNX POST SETTINGS + STORAGE MIGRATION
-- Run once on an existing database, AFTER
-- supabase_auth_completion_migration.sql.
--
-- What this does:
--   1. Enforces post settings that were previously stored but ignored:
--      - visibility ('public' | 'members' | 'admins') now controls who
--        can SELECT a post — and its comments — via RLS.
--      - allowComments = false blocks new comments at the DB level.
--      - isPinned can only be set by the space owner / platform staff.
--      "admins" visibility means: the post author, the community owner,
--      and platform moderators/admins. "members" adds community members.
--   2. Creates the Supabase Storage buckets used for uploads:
--      - avatars     (public, 2 MB, images) — profile pictures
--      - post-images (public, 5 MB, images) — images inside posts
--      Objects live under "<auth.uid>/..." folders; users can only
--      write inside their own folder, everyone can read (public URLs
--      are how avatars/post images are displayed).
-- ==========================================

-- ── 1a. Who can see a post (single source of truth for RLS) ─────────
create or replace function public.can_view_post(p_id uuid)
returns boolean as $$
  select case
    when p."visibility" = 'public' then true
    when auth.uid() is null then false
    when p."authorUid" = auth.uid() then true
    when exists (
      select 1 from public.profiles pr
      where pr."uid" = auth.uid() and pr."role" in ('admin', 'moderator')
    ) then true
    when p."visibility" = 'members'
      and p."communitySlug" is not null
      and exists (
        select 1 from public.community_members m
        where m."communitySlug" = p."communitySlug" and m."userId" = auth.uid()
      ) then true
    when p."visibility" = 'admins'
      and p."communitySlug" is not null
      and exists (
        select 1 from public.communities c
        where c."slug" = p."communitySlug" and c."ownerId" = auth.uid()::text
      ) then true
    else false
  end
  from public.posts p
  where p."id" = p_id;
$$ language sql stable security definer set search_path = public;

-- ── 1b. Posts: visibility-aware reads ───────────────────────────────
drop policy if exists "Public read posts" on public.posts;
drop policy if exists "Read posts per visibility" on public.posts;
create policy "Read posts per visibility" on public.posts
  for select using (public.can_view_post("id"));

-- ── 1c. Pinning is a space-owner / staff action ─────────────────────
drop policy if exists "Auth users can create posts" on public.posts;
create policy "Auth users can create posts" on public.posts
  for insert with check (
    auth.uid() = "authorUid"
    and (
      "isPinned" is not true
      or exists (
        select 1 from public.communities c
        where c."slug" = "communitySlug" and c."ownerId" = auth.uid()::text
      )
      or exists (
        select 1 from public.profiles pr
        where pr."uid" = auth.uid() and pr."role" in ('admin', 'moderator')
      )
    )
  );

drop policy if exists "Authors can update/delete their posts" on public.posts;
create policy "Authors can update/delete their posts" on public.posts
  for update using (auth.uid() = "authorUid")
  with check (
    auth.uid() = "authorUid"
    and (
      "isPinned" is not true
      or exists (
        select 1 from public.communities c
        where c."slug" = "communitySlug" and c."ownerId" = auth.uid()::text
      )
      or exists (
        select 1 from public.profiles pr
        where pr."uid" = auth.uid() and pr."role" in ('admin', 'moderator')
      )
    )
  );

-- ── 1d. Comments: visible only if the post is, blocked when off ─────
drop policy if exists "Public read comments" on public.comments;
drop policy if exists "Read comments per post visibility" on public.comments;
create policy "Read comments per post visibility" on public.comments
  for select using (public.can_view_post("postId"));

drop policy if exists "Auth users can create comments" on public.comments;
create policy "Auth users can create comments" on public.comments
  for insert with check (
    auth.uid() = "authorUid"
    and public.can_view_post("postId")
    and exists (
      select 1 from public.posts p
      where p."id" = "postId" and p."allowComments"
    )
  );

-- ── 1e. Polls: gated by their post's visibility ─────────────────────
drop policy if exists "Public read polls" on public.polls;
drop policy if exists "Read polls per post visibility" on public.polls;
create policy "Read polls per post visibility" on public.polls
  for select using (public.can_view_post("postId"));

drop policy if exists "Public read poll options" on public.poll_options;
drop policy if exists "Read poll options per post visibility" on public.poll_options;
create policy "Read poll options per post visibility" on public.poll_options
  for select using (
    exists (
      select 1 from public.polls
      where polls."id" = "pollId" and public.can_view_post(polls."postId")
    )
  );

drop policy if exists "Public read poll votes" on public.poll_votes;
drop policy if exists "Read poll votes per post visibility" on public.poll_votes;
create policy "Read poll votes per post visibility" on public.poll_votes
  for select using (
    exists (
      select 1 from public.polls
      where polls."id" = "pollId" and public.can_view_post(polls."postId")
    )
  );

drop policy if exists "Auth users can vote once per poll" on public.poll_votes;
create policy "Auth users can vote once per poll" on public.poll_votes
  for insert with check (
    auth.uid() = "userId"
    and exists (
      select 1 from public.polls
      where polls."id" = "pollId" and public.can_view_post(polls."postId")
    )
  );

-- ── 2. Storage buckets ──────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152,
   array['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  ('post-images', 'post-images', true, 5242880,
   array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 3. Storage object policies (own-folder writes, public reads) ────
drop policy if exists "Public read uploaded images" on storage.objects;
create policy "Public read uploaded images" on storage.objects
  for select using (bucket_id in ('avatars', 'post-images'));

drop policy if exists "Users upload images to own folder" on storage.objects;
create policy "Users upload images to own folder" on storage.objects
  for insert with check (
    bucket_id in ('avatars', 'post-images')
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own uploaded images" on storage.objects;
create policy "Users update own uploaded images" on storage.objects
  for update using (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own uploaded images" on storage.objects;
create policy "Users delete own uploaded images" on storage.objects
  for delete using (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
