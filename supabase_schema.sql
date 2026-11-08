-- ==========================================
-- BORYNX SUPABASE DATABASE SCHEMA & CONFIG
-- Complete Schema, RLS Policies, Triggers,
-- Helper RPC Functions & Initial Seed Data
-- ==========================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. TABLES DEFINITION

-- User Profiles
create table if not exists public.profiles (
  "uid" uuid primary key references auth.users(id) on delete cascade,
  "username" text unique not null,
  "displayName" text,
  "initial" text,
  "bio" text default '',
  "location" text default '',
  "website" text default '',
  "joined" text,
  "status" text default 'Available',
  "skills" text[] default '{}',
  "reputation" integer default 0,
  "followers" integer default 0,
  "following" integer default 0,
  "avatarUrl" text,
  "isVerifiedPro" boolean default false,
  "hasSeenVeteranCelebration" boolean default false,
  "communitiesList" jsonb default '{}'::jsonb,
  "role" text default 'member' check ("role" in ('admin', 'moderator', 'member')),
  "createdAt" timestamptz default now()
);

-- Username Registry
create table if not exists public.usernames (
  "username" text primary key,
  "uid" uuid references public.profiles("uid") on delete cascade
);

-- Communities
create table if not exists public.communities (
  "slug" text primary key,
  "name" text not null,
  "description" text not null,
  "icon" text,
  "category" text default 'Other',
  "topics" text[] default '{}',
  "ownerId" text default 'system',
  "memberCount" integer default 0,
  "createdAt" timestamptz default now()
);

-- Posts
create table if not exists public.posts (
  "id" uuid primary key default gen_random_uuid(),
  "title" text not null,
  "body" text not null,
  "category" text,
  "tags" text[] default '{}',
  "type" text default 'discussion',
  "score" integer default 0,
  "ups" integer default 0,
  "downs" integer default 0,
  "views" integer default 0,
  "commentCount" integer default 0,
  "isDeleted" boolean default false,
  "isEdited" boolean default false,
  "createdAt" timestamptz default now(),
  "authorUid" uuid references public.profiles("uid") on delete cascade,
  "communitySlug" text references public.communities("slug") on delete cascade,
  "visibility" text default 'public' check ("visibility" in ('public', 'members', 'admins')),
  "allowComments" boolean default true,
  "isPinned" boolean default false,
  "externalLink" text,
  constraint posts_authorUid_fkey foreign key ("authorUid") references public.profiles("uid") on delete cascade
);

-- Polls (one-to-one with a post when post.type = 'poll')
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

-- Comments
create table if not exists public.comments (
  "id" uuid primary key default gen_random_uuid(),
  "postId" uuid not null references public.posts("id") on delete cascade,
  "parentId" uuid references public.comments("id") on delete cascade,
  "authorUid" uuid not null references public.profiles("uid") on delete cascade,
  "body" text not null,
  "score" integer default 0,
  "ups" integer default 0,
  "downs" integer default 0,
  "isDeleted" boolean default false,
  "isEdited" boolean default false,
  "createdAt" timestamptz default now(),
  constraint comments_authorUid_fkey foreign key ("authorUid") references public.profiles("uid") on delete cascade
);

-- Job Leads
create table if not exists public.leads (
  "id" uuid primary key default gen_random_uuid(),
  "title" text not null,
  "description" text not null,
  "budget" text not null,
  "currency" text not null,
  "location" text not null,
  "type" text not null,
  "status" text default 'open',
  "skills" text[] default '{}',
  "isVerified" boolean default false,
  "postedByUid" uuid not null references public.profiles("uid") on delete cascade,
  "postedAt" timestamptz default now(),
  "applicantsCount" integer default 0,
  constraint leads_postedByUid_fkey foreign key ("postedByUid") references public.profiles("uid") on delete cascade
);

-- Lead Applications (freelancer -> lead proposals)
create table if not exists public.lead_applications (
  "id" uuid primary key default gen_random_uuid(),
  "leadId" uuid not null references public.leads("id") on delete cascade,
  "applicantUid" uuid not null references public.profiles("uid") on delete cascade,
  "proposal" text not null,
  "status" text not null default 'pending'
    check ("status" in ('pending', 'accepted', 'rejected', 'withdrawn')),
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now(),
  unique ("leadId", "applicantUid")
);

-- Notifications (rows are generated by triggers; see the functions below)
create table if not exists public.notifications (
  "id" uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.profiles("uid") on delete cascade,
  "actorUid" uuid references public.profiles("uid") on delete set null,
  "type" text not null check ("type" in (
    'comment', 'reply', 'upvote', 'follow',
    'application_received', 'application_accepted',
    'application_rejected', 'application_withdrawn'
  )),
  "entityId" uuid,
  "contextId" uuid,
  "message" text not null,
  "isRead" boolean not null default false,
  "createdAt" timestamptz default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications ("userId", "createdAt" desc);
create index if not exists idx_notifications_user_unread
  on public.notifications ("userId") where "isRead" = false;



-- Reports (moderation queue; see the functions below)
create table if not exists public.reports (
  "id" uuid primary key default gen_random_uuid(),
  "reporterUid" uuid not null references public.profiles("uid") on delete cascade,
  "entityType" text not null check ("entityType" in ('post', 'comment', 'lead', 'profile')),
  "entityId" uuid not null,
  "reason" text not null check ("reason" in ('spam', 'harassment', 'scam', 'inappropriate', 'other')),
  "details" text default '',
  "status" text not null default 'open' check ("status" in ('open', 'resolved', 'dismissed')),
  "resolvedBy" uuid references public.profiles("uid") on delete set null,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);

create index if not exists idx_reports_status_created
  on public.reports ("status", "createdAt" desc);
create index if not exists idx_reports_reporter
  on public.reports ("reporterUid");



-- Community Memberships
create table if not exists public.community_members (
  "userId" uuid references public.profiles("uid") on delete cascade,
  "communitySlug" text references public.communities("slug") on delete cascade,
  primary key ("userId", "communitySlug")
);

-- Saved Posts / Bookmarks
create table if not exists public.saved_posts (
  "userId" uuid references public.profiles("uid") on delete cascade,
  "postId" uuid references public.posts("id") on delete cascade,
  primary key ("userId", "postId")
);

-- User Follows
create table if not exists public.follows (
  "followerId" uuid references public.profiles("uid") on delete cascade,
  "followingId" uuid references public.profiles("uid") on delete cascade,
  primary key ("followerId", "followingId")
);

-- Upvotes / Downvotes
create table if not exists public.votes (
  "id" uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.profiles("uid") on delete cascade,
  "entityType" text not null check ("entityType" in ('post', 'comment')),
  "entityId" uuid not null,
  "voteValue" integer not null check ("voteValue" in (1, -1)),
  unique ("userId", "entityType", "entityId")
);

-- 2. INDEXES FOR PERFORMANCE

create index if not exists idx_posts_createdAt on public.posts ("createdAt" desc);
create index if not exists idx_posts_authorUid on public.posts ("authorUid");
create index if not exists idx_posts_communitySlug on public.posts ("communitySlug");
create index if not exists idx_comments_postId on public.comments ("postId");
create index if not exists idx_comments_authorUid on public.comments ("authorUid");
create index if not exists idx_leads_postedAt on public.leads ("postedAt" desc);
create index if not exists idx_lead_applications_leadId on public.lead_applications ("leadId");
create index if not exists idx_lead_applications_applicantUid on public.lead_applications ("applicantUid");
create index if not exists idx_votes_entity on public.votes ("entityType", "entityId", "userId");

-- 3. ROW LEVEL SECURITY (RLS) POLICIES

alter table public.profiles enable row level security;
alter table public.usernames enable row level security;
alter table public.communities enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.leads enable row level security;
alter table public.lead_applications enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.community_members enable row level security;
alter table public.saved_posts enable row level security;
alter table public.follows enable row level security;
alter table public.votes enable row level security;

-- profiles RLS
drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles" on public.profiles for select using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = "uid");

drop policy if exists "Users can insert profile" on public.profiles;
create policy "Users can insert profile" on public.profiles for insert with check (auth.uid() = "uid");

-- usernames RLS
drop policy if exists "Public read usernames" on public.usernames;
create policy "Public read usernames" on public.usernames for select using (true);

drop policy if exists "Profiles can insert/update their username" on public.usernames;
create policy "Profiles can insert/update their username" on public.usernames for all using (auth.uid() = "uid");

-- communities RLS
drop policy if exists "Public read communities" on public.communities;
create policy "Public read communities" on public.communities for select using (true);

drop policy if exists "Auth users can insert/update communities" on public.communities;
drop policy if exists "Auth users can create communities" on public.communities;
create policy "Auth users can create communities" on public.communities
  for insert with check (auth.role() = 'authenticated' and auth.uid()::text = "ownerId");
drop policy if exists "Owners and admins can update communities" on public.communities;
create policy "Owners and admins can update communities" on public.communities
  for update using (
    auth.uid()::text = "ownerId"
    or exists (select 1 from public.profiles where profiles."uid" = auth.uid() and profiles."role" = 'admin')
  ) with check (
    auth.uid()::text = "ownerId"
    or exists (select 1 from public.profiles where profiles."uid" = auth.uid() and profiles."role" = 'admin')
  );

-- Who can see a post: single source of truth for post/comment/poll RLS.
-- 'admins' visibility = author + community owner + platform staff;
-- 'members' additionally includes community members.
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

-- posts RLS
drop policy if exists "Public read posts" on public.posts;
drop policy if exists "Read posts per visibility" on public.posts;
create policy "Read posts per visibility" on public.posts
  for select using (public.can_view_post("id"));

-- Pinning is a space-owner / staff action, enforced here as well as in the UI.
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

-- NOTE: view/score counters are maintained by SECURITY DEFINER RPCs
-- (increment_post_views, cast_vote), while commentCount is maintained by a
-- SECURITY DEFINER trigger below. There is deliberately NO general-purpose
-- counter update policy: RLS is row-level, so such a policy would let anyone
-- rewrite other columns too.

-- polls RLS
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "Public read polls" on public.polls;
drop policy if exists "Read polls per post visibility" on public.polls;
create policy "Read polls per post visibility" on public.polls
  for select using (public.can_view_post("postId"));
drop policy if exists "Post author can create poll" on public.polls;
create policy "Post author can create poll" on public.polls for insert with check (
  exists (select 1 from public.posts where posts."id" = "postId" and posts."authorUid" = auth.uid())
);

drop policy if exists "Public read poll options" on public.poll_options;
drop policy if exists "Read poll options per post visibility" on public.poll_options;
create policy "Read poll options per post visibility" on public.poll_options
  for select using (
    exists (
      select 1 from public.polls
      where polls."id" = "pollId" and public.can_view_post(polls."postId")
    )
  );
drop policy if exists "Post author can create poll options" on public.poll_options;
create policy "Post author can create poll options" on public.poll_options for insert with check (
  exists (
    select 1 from public.polls
    join public.posts on posts."id" = polls."postId"
    where polls."id" = "pollId" and posts."authorUid" = auth.uid()
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

-- comments RLS
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
      where p."id" = "postId" and p."allowComments" and p."isDeleted" is not true
    )
    and (
      "parentId" is null
      or exists (
        select 1 from public.comments parent
        where parent."id" = comments."parentId" and parent."postId" = comments."postId"
      )
    )
  );

drop policy if exists "Authors can update/delete their comments" on public.comments;
create policy "Authors can update/delete their comments" on public.comments for update using (auth.uid() = "authorUid");

-- Comment scores are updated only through the cast_vote RPC (see below).

-- leads RLS
drop policy if exists "Public read leads" on public.leads;
create policy "Public read leads" on public.leads for select using (true);

drop policy if exists "Auth users can create leads" on public.leads;
create policy "Auth users can create leads" on public.leads for insert with check (auth.uid() = "postedByUid");

drop policy if exists "Creators can update their leads" on public.leads;
create policy "Creators can update their leads" on public.leads for update using (auth.uid() = "postedByUid");

-- lead_applications RLS
drop policy if exists "Applicants and lead owners can read applications" on public.lead_applications;
create policy "Applicants and lead owners can read applications"
  on public.lead_applications for select
  using (
    auth.uid() = "applicantUid"
    or exists (
      select 1 from public.leads
      where leads."id" = "leadId" and leads."postedByUid" = auth.uid()
    )
  );

drop policy if exists "Users can apply to open leads" on public.lead_applications;
create policy "Users can apply to open leads"
  on public.lead_applications for insert
  with check (
    auth.uid() = "applicantUid"
    and exists (
      select 1 from public.leads
      where leads."id" = "leadId"
        and leads."status" = 'open'
        and leads."postedByUid" <> auth.uid()
    )
  );

drop policy if exists "Applicant or lead owner can update application" on public.lead_applications;
create policy "Applicant or lead owner can update application"
  on public.lead_applications for update
  using (
    auth.uid() = "applicantUid"
    or exists (
      select 1 from public.leads
      where leads."id" = "leadId" and leads."postedByUid" = auth.uid()
    )
  )
  with check (
    auth.uid() = "applicantUid"
    or exists (
      select 1 from public.leads
      where leads."id" = "leadId" and leads."postedByUid" = auth.uid()
    )
  );

-- notifications RLS
-- Only read + mark-read for the owner; rows are created exclusively by
-- SECURITY DEFINER triggers. No client INSERT/DELETE policies exist.
drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select
  using (auth.uid() = "userId");

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = "userId")
  with check (auth.uid() = "userId");

-- reports RLS
drop policy if exists "Users can file reports" on public.reports;
create policy "Users can file reports"
  on public.reports for insert
  with check (auth.uid() = "reporterUid");

drop policy if exists "Reporters and moderators can read reports" on public.reports;
create policy "Reporters and moderators can read reports"
  on public.reports for select
  using (
    auth.uid() = "reporterUid"
    or exists (
      select 1 from public.profiles
      where profiles."uid" = auth.uid()
        and profiles."role" in ('admin', 'moderator')
    )
  );

drop policy if exists "Moderators can update reports" on public.reports;
create policy "Moderators can update reports"
  on public.reports for update
  using (
    exists (
      select 1 from public.profiles
      where profiles."uid" = auth.uid()
        and profiles."role" in ('admin', 'moderator')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles."uid" = auth.uid()
        and profiles."role" in ('admin', 'moderator')
    )
  );


-- community_members RLS
drop policy if exists "Public read memberships" on public.community_members;
create policy "Public read memberships" on public.community_members for select using (true);

drop policy if exists "Users can manage their memberships" on public.community_members;
create policy "Users can manage their memberships" on public.community_members for all using (auth.uid() = "userId");

-- saved_posts RLS
drop policy if exists "Users can read their own bookmarks" on public.saved_posts;
create policy "Users can read their own bookmarks" on public.saved_posts for select using (auth.uid() = "userId");

drop policy if exists "Users can manage their own bookmarks" on public.saved_posts;
create policy "Users can manage their own bookmarks" on public.saved_posts for all using (auth.uid() = "userId");

-- follows RLS
drop policy if exists "Public read follows" on public.follows;
create policy "Public read follows" on public.follows for select using (true);

drop policy if exists "Users can manage their own follows" on public.follows;
create policy "Users can manage their own follows" on public.follows for all using (auth.uid() = "followerId");

-- votes RLS
drop policy if exists "Public read votes" on public.votes;
create policy "Public read votes" on public.votes for select using (true);

drop policy if exists "Users can manage their own votes" on public.votes;
create policy "Users can manage their own votes" on public.votes for all using (auth.uid() = "userId");


-- Lead applications: column guard + applicantsCount maintenance
create or replace function public.guard_lead_application_update()
returns trigger as $$
declare
  is_owner boolean;
begin
  select exists (
    select 1 from public.leads
    where leads."id" = old."leadId" and leads."postedByUid" = auth.uid()
  ) into is_owner;

  if auth.uid() = old."applicantUid" and not is_owner then
    -- Applicants may only withdraw (and un-withdraw by re-applying, which
    -- the client does by setting status back to 'pending' with a new
    -- proposal). Nothing else about the row may change.
    if new."status" not in ('withdrawn', 'pending')
       or new."leadId" <> old."leadId"
       or new."applicantUid" <> old."applicantUid" then
      raise exception 'Applicants can only withdraw or re-apply';
    end if;
  elsif is_owner then
    -- Owners may only change the review status.
    if new."proposal" <> old."proposal"
       or new."leadId" <> old."leadId"
       or new."applicantUid" <> old."applicantUid" then
      raise exception 'Lead owners can only change application status';
    end if;
    if new."status" not in ('pending', 'accepted', 'rejected') then
      raise exception 'Invalid review status: %', new."status";
    end if;
  end if;

  new."updatedAt" := now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_guard_lead_application_update on public.lead_applications;
create trigger trg_guard_lead_application_update
  before update on public.lead_applications
  for each row execute function public.guard_lead_application_update();


-- 4. applicantsCount maintenance --------------------------------
create or replace function public.maintain_lead_applicants_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new."status" <> 'withdrawn' then
      update public.leads
      set "applicantsCount" = coalesce("applicantsCount", 0) + 1
      where "id" = new."leadId";
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old."status" <> 'withdrawn' then
      update public.leads
      set "applicantsCount" = greatest(0, coalesce("applicantsCount", 0) - 1)
      where "id" = old."leadId";
    end if;
    return old;
  else -- UPDATE: only withdrawn <-> non-withdrawn transitions move the count
    if old."status" = 'withdrawn' and new."status" <> 'withdrawn' then
      update public.leads
      set "applicantsCount" = coalesce("applicantsCount", 0) + 1
      where "id" = new."leadId";
    elsif old."status" <> 'withdrawn' and new."status" = 'withdrawn' then
      update public.leads
      set "applicantsCount" = greatest(0, coalesce("applicantsCount", 0) - 1)
      where "id" = new."leadId";
    end if;
    return new;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_lead_applicants_count on public.lead_applications;
create trigger trg_lead_applicants_count
  after insert or delete or update of "status" on public.lead_applications
  for each row execute function public.maintain_lead_applicants_count();

update public.leads l
set "applicantsCount" = (
  select count(*) from public.lead_applications a
  where a."leadId" = l."id" and a."status" <> 'withdrawn'
);

-- 4. RPC FUNCTIONS FOR APPLICATION STATE INCREMENT/DECREMENT

-- Increment Post Views
create or replace function public.increment_post_views(post_id uuid)
returns void as $$
begin
  update public.posts
  set views = coalesce(views, 0) + 1
  where id = post_id;
end;
$$ language plpgsql security definer;

-- Increment Followers
create or replace function public.increment_followers(target_uid uuid)
returns void as $$
begin
  update public.profiles
  set followers = coalesce(followers, 0) + 1
  where uid = target_uid;
end;
$$ language plpgsql security definer;

-- Decrement Followers
create or replace function public.decrement_followers(target_uid uuid)
returns void as $$
begin
  update public.profiles
  set followers = greatest(0, coalesce(followers, 0) - 1)
  where uid = target_uid;
end;
$$ language plpgsql security definer;

-- Increment Following
create or replace function public.increment_following(target_uid uuid)
returns void as $$
begin
  update public.profiles
  set following = coalesce(following, 0) + 1
  where uid = target_uid;
end;
$$ language plpgsql security definer;

-- Decrement Following
create or replace function public.decrement_following(target_uid uuid)
returns void as $$
begin
  update public.profiles
  set following = greatest(0, coalesce(following, 0) - 1)
  where uid = target_uid;
end;
$$ language plpgsql security definer;

-- Increment Community Members
create or replace function public.increment_community_members(community_slug text)
returns void as $$
begin
  update public.communities
  set "memberCount" = coalesce("memberCount", 0) + 1
  where slug = community_slug;
end;
$$ language plpgsql security definer;

-- Decrement Community Members
create or replace function public.decrement_community_members(community_slug text)
returns void as $$
begin
  update public.communities
  set "memberCount" = greatest(0, coalesce("memberCount", 0) - 1)
  where slug = community_slug;
end;
$$ language plpgsql security definer;

-- Helper to update community JSONB list in profile
create or replace function public.jsonb_set_community(uid uuid, slug text, value boolean)
returns jsonb as $$
declare
  curr_list jsonb;
begin
  select coalesce("communitiesList", '{}'::jsonb) into curr_list
  from public.profiles where "uid" = jsonb_set_community.uid;

  if curr_list is null then
    curr_list := '{}'::jsonb;
  end if;

  return jsonb_set(curr_list, array[slug], to_jsonb(value));
end;
$$ language plpgsql security definer;


create or replace function public.maintain_post_comment_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    if NEW."isDeleted" is not true then
      -- The UPDATE locks the post row: if a concurrent delete/closure wins
      -- first, the insert fails and rolls back instead of adding a reply to
      -- an already-frozen post.
      update public.posts
      set "commentCount" = coalesce("commentCount", 0) + 1
      where "id" = NEW."postId" and "isDeleted" is not true and "allowComments" is true;
      if not found then
        raise exception 'Comments are closed for this post';
      end if;
    end if;
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    if OLD."isDeleted" is not true then
      update public.posts
      set "commentCount" = greatest(0, coalesce("commentCount", 0) - 1)
      where "id" = OLD."postId";
    end if;
    return OLD;
  end if;

  -- UPDATE: moving a comment between posts (defensive; the app never
  -- does this) or soft-delete / restore transitions.
  if OLD."postId" is distinct from NEW."postId" then
    if OLD."isDeleted" is not true then
      update public.posts
      set "commentCount" = greatest(0, coalesce("commentCount", 0) - 1)
      where "id" = OLD."postId";
    end if;
    if NEW."isDeleted" is not true then
      update public.posts
      set "commentCount" = coalesce("commentCount", 0) + 1
      where "id" = NEW."postId" and "isDeleted" is not true and "allowComments" is true;
      if not found then
        raise exception 'Comments are closed for this post';
      end if;
    end if;
  elsif coalesce(OLD."isDeleted", false) <> coalesce(NEW."isDeleted", false) then
    if NEW."isDeleted" is true then
      update public.posts
      set "commentCount" = greatest(0, coalesce("commentCount", 0) - 1)
      where "id" = NEW."postId";
    else
      update public.posts
      set "commentCount" = coalesce("commentCount", 0) + 1
      where "id" = NEW."postId";
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_post_comment_count on public.comments;
create trigger trg_post_comment_count
  after insert or delete or update of "isDeleted", "postId" on public.comments
  for each row execute function public.maintain_post_comment_count();

-- Reconcile counters with the new semantics (non-deleted comments).
update public.posts p
set "commentCount" = (
  select count(*)::integer
  from public.comments c
  where c."postId" = p."id" and c."isDeleted" is not true
);

-- The client no longer calls this; the trigger above owns the counter.
drop function if exists public.increment_comment_count(uuid);


-- Cast Vote (atomic, server-computed)
-- The client supplies only (entity, desired vote). This function reads the
-- previous vote, derives the author from the entity itself, computes all
-- deltas, and updates votes + entity score/ups/downs + author reputation in
-- one transaction. It replaces the old client-side read-modify-write, which
-- both raced under concurrency and silently failed under hardened RLS.
-- The earlier apply_vote_aggregate(uuid,text,uuid,uuid,int,int,int) helper
-- trusted caller-supplied deltas and author ids, so it is dropped here.
drop function if exists public.apply_vote_aggregate(uuid, text, uuid, uuid, integer, integer, integer);

create or replace function public.cast_vote(
  entity_id uuid,
  entity_type text,
  voter_uid uuid,
  new_vote integer
)
returns void as $$
declare
  previous_vote integer := 0;
  entity_author uuid;
  entity_post_id uuid;
  entity_is_deleted boolean := false;
  parent_post_is_deleted boolean := false;
  score_delta integer;
  ups_delta integer;
  downs_delta integer;
begin
  if auth.uid() is null or auth.uid() <> voter_uid then
    raise exception 'Not authorized to vote as another user';
  end if;

  if new_vote is null or new_vote not in (-1, 0, 1) then
    raise exception 'Invalid vote value: %', new_vote;
  end if;

  -- Row locks make deletion / visibility edits and a vote serialize:
  -- once a post or comment is removed, later votes see the removed state.
  if entity_type = 'post' then
    select "authorUid", "id", coalesce("isDeleted", false)
      into entity_author, entity_post_id, entity_is_deleted
    from public.posts
    where id = entity_id
    for update;
  elsif entity_type = 'comment' then
    select c."authorUid", c."postId", coalesce(c."isDeleted", false), coalesce(p."isDeleted", false)
      into entity_author, entity_post_id, entity_is_deleted, parent_post_is_deleted
    from public.comments c
    join public.posts p on p."id" = c."postId"
    where c."id" = entity_id
    for update of c, p;
  else
    raise exception 'Unsupported vote entity type: %', entity_type;
  end if;

  if entity_author is null then
    raise exception 'Vote target not found';
  end if;

  if entity_is_deleted or parent_post_is_deleted then
    raise exception 'Cannot vote on deleted content';
  end if;

  -- SECURITY DEFINER bypasses RLS, so visibility must be checked here.
  if not public.can_view_post(entity_post_id) then
    raise exception 'Not authorized to vote on this content';
  end if;

  if entity_author = voter_uid then
    raise exception 'You cannot vote on your own content';
  end if;

  -- Serialize votes by the same voter on the same entity for the rest of
  -- this transaction; without this, two concurrent calls can both read
  -- "no previous vote" and apply the same delta twice.
  perform pg_advisory_xact_lock(
    hashtextextended(voter_uid::text || ':' || entity_type || ':' || entity_id::text, 0)
  );

  select "voteValue" into previous_vote
  from public.votes
  where "userId" = voter_uid and "entityType" = entity_type and "entityId" = entity_id
  for update;
  previous_vote := coalesce(previous_vote, 0);

  if previous_vote = new_vote then
    return;
  end if;

  if new_vote = 0 then
    delete from public.votes
    where "userId" = voter_uid and "entityType" = entity_type and "entityId" = entity_id;
  else
    insert into public.votes ("userId", "entityType", "entityId", "voteValue")
    values (voter_uid, entity_type, entity_id, new_vote)
    on conflict ("userId", "entityType", "entityId")
    do update set "voteValue" = excluded."voteValue";
  end if;

  score_delta := new_vote - previous_vote;
  ups_delta := (case when new_vote = 1 then 1 else 0 end) - (case when previous_vote = 1 then 1 else 0 end);
  downs_delta := (case when new_vote = -1 then 1 else 0 end) - (case when previous_vote = -1 then 1 else 0 end);

  if entity_type = 'post' then
    update public.posts
    set score = coalesce(score, 0) + score_delta,
        ups = coalesce(ups, 0) + ups_delta,
        downs = coalesce(downs, 0) + downs_delta
    where id = entity_id;
  else
    update public.comments
    set score = coalesce(score, 0) + score_delta,
        ups = coalesce(ups, 0) + ups_delta,
        downs = coalesce(downs, 0) + downs_delta
    where id = entity_id;
  end if;

  if entity_author <> voter_uid then
    update public.profiles
    set reputation = coalesce(reputation, 0) + score_delta
    where uid = entity_author;
  end if;
end;
$$ language plpgsql security definer set search_path = public;


-- 4b. NOTIFICATION TRIGGERS

-- Only "isRead" may ever change on a notification row.
create or replace function public.guard_notification_update()
returns trigger as $$
begin
  if new."userId" <> old."userId"
     or new."actorUid" is distinct from old."actorUid"
     or new."type" <> old."type"
     or new."entityId" is distinct from old."entityId"
     or new."contextId" is distinct from old."contextId"
     or new."message" <> old."message"
     or new."createdAt" <> old."createdAt" then
    raise exception 'Only the read state of a notification can change';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_guard_notification_update on public.notifications;
create trigger trg_guard_notification_update
  before update on public.notifications
  for each row execute function public.guard_notification_update();


-- 3. Helpers -----------------------------------------------------
create or replace function public.notification_actor_name(actor_uid uuid)
returns text as $$
declare
  actor_name text;
begin
  select coalesce("displayName", "username", 'Someone')
  into actor_name
  from public.profiles
  where "uid" = actor_uid;
  return coalesce(actor_name, 'Someone');
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.create_notification(
  recipient uuid,
  actor uuid,
  notif_type text,
  entity_id uuid,
  context_id uuid,
  message text
)
returns void as $$
begin
  -- Never notify people about their own actions.
  if recipient is null or actor is null or recipient = actor then
    return;
  end if;
  insert into public.notifications ("userId", "actorUid", "type", "entityId", "contextId", "message")
  values (recipient, actor, notif_type, entity_id, context_id, message);
end;
$$ language plpgsql security definer set search_path = public;


-- 4. Event triggers ----------------------------------------------

-- Comments & replies
create or replace function public.notify_on_comment()
returns trigger as $$
declare
  post_author uuid;
  post_title text;
  parent_author uuid;
  actor_name text := public.notification_actor_name(new."authorUid");
begin
  select "authorUid", "title" into post_author, post_title
  from public.posts where "id" = new."postId";

  if new."parentId" is not null then
    select "authorUid" into parent_author
    from public.comments where "id" = new."parentId";

    perform public.create_notification(
      parent_author, new."authorUid", 'reply', new."id", new."postId",
      actor_name || ' replied to your comment'
    );

    -- Also tell the post author when someone else joins the thread.
    if post_author is distinct from parent_author then
      perform public.create_notification(
        post_author, new."authorUid", 'comment', new."id", new."postId",
        actor_name || ' commented on your post "' || left(post_title, 60) || '"'
      );
    end if;
  else
    perform public.create_notification(
      post_author, new."authorUid", 'comment', new."id", new."postId",
      actor_name || ' commented on your post "' || left(post_title, 60) || '"'
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_on_comment on public.comments;
create trigger trg_notify_on_comment
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- Upvotes (fires from the votes table, so it works for the cast_vote RPC too)
create or replace function public.notify_on_vote()
returns trigger as $$
declare
  entity_author uuid;
  context_id uuid;
  actor_name text := public.notification_actor_name(new."userId");
begin
  -- Only brand-new upvotes notify: not downvotes, not vote removals,
  -- and not an unchanged upvote re-saved by an upsert.
  if new."voteValue" <> 1 then
    return new;
  end if;
  if tg_op = 'UPDATE' and old."voteValue" = 1 then
    return new;
  end if;

  if new."entityType" = 'post' then
    select "authorUid" into entity_author from public.posts where "id" = new."entityId";
    context_id := new."entityId";
  else
    select "authorUid", "postId" into entity_author, context_id
    from public.comments where "id" = new."entityId";
  end if;

  perform public.create_notification(
    entity_author, new."userId", 'upvote', new."entityId", context_id,
    actor_name || ' upvoted your ' || new."entityType"
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_on_vote on public.votes;
create trigger trg_notify_on_vote
  after insert or update on public.votes
  for each row execute function public.notify_on_vote();

-- Follows
create or replace function public.notify_on_follow()
returns trigger as $$
begin
  perform public.create_notification(
    new."followingId", new."followerId", 'follow', new."followerId", null,
    public.notification_actor_name(new."followerId") || ' started following you'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_on_follow on public.follows;
create trigger trg_notify_on_follow
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- Lead applications (received / accepted / rejected / withdrawn)
create or replace function public.notify_on_application()
returns trigger as $$
declare
  lead_owner uuid;
  lead_title text;
  actor_name text;
begin
  select "postedByUid", "title" into lead_owner, lead_title
  from public.leads where "id" = new."leadId";

  if tg_op = 'INSERT' then
    perform public.create_notification(
      lead_owner, new."applicantUid", 'application_received', new."id", new."leadId",
      public.notification_actor_name(new."applicantUid") ||
        ' applied to your lead "' || left(lead_title, 60) || '"'
    );
    return new;
  end if;

  -- UPDATE: only status transitions notify.
  if new."status" = old."status" then
    return new;
  end if;

  if new."status" in ('accepted', 'rejected') then
    perform public.create_notification(
      new."applicantUid", lead_owner, 'application_' || new."status", new."id", new."leadId",
      'Your application to "' || left(lead_title, 60) || '" was ' || new."status"
    );
  elsif new."status" = 'withdrawn' then
    perform public.create_notification(
      lead_owner, new."applicantUid", 'application_withdrawn', new."id", new."leadId",
      public.notification_actor_name(new."applicantUid") ||
        ' withdrew their application to "' || left(lead_title, 60) || '"'
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_on_application on public.lead_applications;
create trigger trg_notify_on_application
  after insert or update of "status" on public.lead_applications
  for each row execute function public.notify_on_application();


-- 4c. REPORTS & MODERATION

-- Only status/resolvedBy/updatedAt may change, and only via moderation.
create or replace function public.guard_report_update()
returns trigger as $$
begin
  if new."reporterUid" <> old."reporterUid"
     or new."entityType" <> old."entityType"
     or new."entityId" <> old."entityId"
     or new."reason" <> old."reason"
     or new."details" is distinct from old."details"
     or new."createdAt" <> old."createdAt" then
    raise exception 'Only the moderation status of a report can change';
  end if;
  new."updatedAt" := now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_guard_report_update on public.reports;
create trigger trg_guard_report_update
  before update on public.reports
  for each row execute function public.guard_report_update();

-- Moderator check helper
create or replace function public.is_moderator(uid uuid)
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where profiles."uid" = is_moderator.uid
      and profiles."role" in ('admin', 'moderator')
  );
$$ language sql security definer set search_path = public;

create or replace function public.is_admin(uid uuid)
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where profiles."uid" = is_admin.uid
      and profiles."role" = 'admin'
  );
$$ language sql security definer set search_path = public;


-- 3. Moderation actions (RPC) ---------------------------------------
create or replace function public.moderate_report(
  report_id uuid,
  new_status text,
  remove_content boolean default false
)
returns void as $$
declare
  target record;
begin
  if not public.is_moderator(auth.uid()) then
    raise exception 'Only moderators can moderate reports';
  end if;

  if new_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'Invalid report status: %', new_status;
  end if;

  select "entityType", "entityId" into target
  from public.reports where "id" = report_id;

  if not found then
    raise exception 'Report not found';
  end if;

  if remove_content then
    if target."entityType" = 'post' then
      update public.posts set "isDeleted" = true where "id" = target."entityId";
    elsif target."entityType" = 'comment' then
      update public.comments set "isDeleted" = true where "id" = target."entityId";
    elsif target."entityType" = 'lead' then
      update public.leads set "status" = 'closed' where "id" = target."entityId";
    end if;
    -- 'profile' reports have no automatic content action; handle via roles.
  end if;

  update public.reports
  set "status" = new_status,
      "resolvedBy" = case when new_status = 'open' then null else auth.uid() end
  where "id" = report_id;
end;
$$ language plpgsql security definer set search_path = public;


-- 4. Verified Pro + roles (admin only, via RPC) ----------------------
-- Eligibility guideline used by the admin UI: reputation >= 1,000
-- (Trusted Voice) + a manual quality review. The RPC enforces only the
-- permission; the threshold is a policy shown to admins, not a hard rule,
-- so exceptional contributors can be verified early by an admin.
create or replace function public.set_user_verified_pro(
  target_uid uuid,
  verified boolean
)
returns void as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only admins can change Verified Pro status';
  end if;

  update public.profiles
  set "isVerifiedPro" = verified
  where "uid" = target_uid;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.set_user_role(
  target_uid uuid,
  new_role text
)
returns void as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only admins can change roles';
  end if;

  if new_role not in ('admin', 'moderator', 'member') then
    raise exception 'Invalid role: %', new_role;
  end if;

  -- Prevent an admin from locking themselves out by demoting themselves.
  if target_uid = auth.uid() and new_role <> 'admin' then
    raise exception 'Admins cannot demote themselves';
  end if;

  update public.profiles
  set "role" = new_role
  where "uid" = target_uid;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$ language plpgsql security definer set search_path = public;


-- 5. AUTH USER CREATION TRIGGER

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_username text;
  username_exists boolean;
  display_name text;
  requested_username text;
begin
  display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  -- Honor a username requested at signup when well-formed and free.
  requested_username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if requested_username ~ '^[a-z0-9_]{3,15}$'
     and not exists (select 1 from public.profiles where username = requested_username)
     and not exists (select 1 from public.usernames where username = requested_username) then
    new_username := requested_username;
  else
    -- Generate a unique fallback handle
    loop
      new_username := 'user_' || substring(md5(random()::text) from 1 for 6);
      select exists(select 1 from public.profiles where username = new_username) into username_exists;
      if not username_exists then
        exit;
      end if;
    end loop;
  end if;

  insert into public.profiles (
    uid,
    username,
    "displayName",
    initial,
    bio,
    location,
    website,
    joined,
    status,
    reputation,
    followers,
    following,
    "isVerifiedPro",
    "hasSeenVeteranCelebration",
    "createdAt"
  )
  values (
    new.id,
    new_username,
    display_name,
    upper(substring(display_name from 1 for 1)),
    'New to Borynx!',
    'Earth',
    '',
    to_char(now(), 'YYYY'),
    'Available',
    10,
    0,
    0,
    false,
    false,
    now()
  );

  insert into public.usernames (username, uid)
  values (new_username, new.id);

  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 6. INITIAL SEED DATA

-- Communities Seed
insert into public.communities (slug, name, description, icon, category, topics, "ownerId", "memberCount", "createdAt")
values 
  ('design', 'Design', 'UI, UX, branding, illustration.', 'Palette', 'Design', array['ui', 'ux', 'branding'], 'system', 120, now()),
  ('dev', 'Freelance Dev', 'Web, mobile, full-stack devs going solo.', 'Code2', 'Development', array['web', 'mobile', 'backend'], 'system', 340, now()),
  ('writing', 'Writing', 'Copywriters, content writers, ghostwriters.', 'PenTool', 'Other', array['copy', 'content', 'ghostwriting'], 'system', 85, now()),
  ('marketing', 'Marketing', 'Growth, SEO, paid ads, email.', 'Megaphone', 'Marketing', array['seo', 'growth', 'ads'], 'system', 95, now()),
  ('video', 'Video & Motion', 'Editors, motion designers, animators.', 'Video', 'Other', array['video', 'motion', 'animation'], 'system', 50, now()),
  ('consulting', 'Consulting', 'Strategy, ops, advisory work.', 'Briefcase', 'Business', array['strategy', 'ops', 'advisory'], 'system', 150, now())
on conflict (slug) do nothing;


-- ==========================================
-- STORAGE: uploaded images (avatars, post images)
-- Objects live under "<auth.uid>/..." folders: users write only inside
-- their own folder; reads are public so image URLs render anywhere.
-- ==========================================
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
