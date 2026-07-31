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
  "bio" text default 'New to Borynx!',
  "location" text default 'Earth',
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
create index if not exists idx_votes_entity on public.votes ("entityType", "entityId", "userId");

-- 3. ROW LEVEL SECURITY (RLS) POLICIES

alter table public.profiles enable row level security;
alter table public.usernames enable row level security;
alter table public.communities enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.leads enable row level security;
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

-- posts RLS
drop policy if exists "Public read posts" on public.posts;
create policy "Public read posts" on public.posts for select using (true);

drop policy if exists "Auth users can create posts" on public.posts;
create policy "Auth users can create posts" on public.posts for insert with check (auth.uid() = "authorUid");

drop policy if exists "Authors can update/delete their posts" on public.posts;
create policy "Authors can update/delete their posts" on public.posts for update using (auth.uid() = "authorUid");

drop policy if exists "Anyone can update post views, score, and commentCount" on public.posts;

-- polls RLS
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

-- comments RLS
drop policy if exists "Public read comments" on public.comments;
create policy "Public read comments" on public.comments for select using (true);

drop policy if exists "Auth users can create comments" on public.comments;
create policy "Auth users can create comments" on public.comments for insert with check (auth.uid() = "authorUid");

drop policy if exists "Authors can update/delete their comments" on public.comments;
create policy "Authors can update/delete their comments" on public.comments for update using (auth.uid() = "authorUid");

drop policy if exists "Anyone can update comment score" on public.comments;

-- leads RLS
drop policy if exists "Public read leads" on public.leads;
create policy "Public read leads" on public.leads for select using (true);

drop policy if exists "Auth users can create leads" on public.leads;
create policy "Auth users can create leads" on public.leads for insert with check (auth.uid() = "postedByUid");

drop policy if exists "Creators can update their leads" on public.leads;
create policy "Creators can update their leads" on public.leads for update using (auth.uid() = "postedByUid");

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

-- Increment Comment Count
create or replace function public.increment_comment_count(post_id uuid)
returns void as $$
begin
  update public.posts
  set "commentCount" = coalesce("commentCount", 0) + 1
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

-- Apply vote aggregate changes after the caller has created/updated/deleted
-- their row in public.votes. This replaces broad client update policies on
-- posts/comments/profiles while preserving voting behavior.
create or replace function public.apply_vote_aggregate(
  entity_id uuid,
  entity_type text,
  author_uid uuid,
  voter_uid uuid,
  score_delta integer,
  ups_delta integer,
  downs_delta integer
)
returns void as $$
begin
  if auth.uid() is null or auth.uid() <> voter_uid then
    raise exception 'Not authorized to apply vote aggregate';
  end if;

  if entity_type = 'post' then
    update public.posts
    set score = coalesce(score, 0) + score_delta,
        ups = coalesce(ups, 0) + ups_delta,
        downs = coalesce(downs, 0) + downs_delta
    where id = entity_id;
  elsif entity_type = 'comment' then
    update public.comments
    set score = coalesce(score, 0) + score_delta,
        ups = coalesce(ups, 0) + ups_delta,
        downs = coalesce(downs, 0) + downs_delta
    where id = entity_id;
  else
    raise exception 'Unsupported vote entity type: %', entity_type;
  end if;

  if author_uid is not null and author_uid <> voter_uid then
    update public.profiles
    set reputation = coalesce(reputation, 0) + score_delta
    where uid = author_uid;
  end if;
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


-- 5. AUTH USER CREATION TRIGGER

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_username text;
  username_exists boolean;
  display_name text;
begin
  -- Generate unique handle
  loop
    new_username := 'user_' || substring(md5(random()::text) from 1 for 6);
    select exists(select 1 from public.profiles where username = new_username) into username_exists;
    if not username_exists then
      exit;
    end if;
  end loop;

  display_name := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));

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
