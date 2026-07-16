-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create tables
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
  "createdAt" timestamptz default now()
);

create table if not exists public.usernames (
  "username" text primary key,
  "uid" uuid references public.profiles("uid") on delete cascade
);

create table if not exists public.communities (
  "slug" text primary key,
  "name" text not null,
  "description" text not null,
  "icon" text,
  "topics" text[] default '{}',
  "ownerId" text default 'system',
  "memberCount" integer default 0,
  "createdAt" timestamptz default now()
);

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
  "communitySlug" text references public.communities("slug") on delete cascade
);

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
  "createdAt" timestamptz default now()
);

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
  "applicantsCount" integer default 0
);

create table if not exists public.community_members (
  "userId" uuid references public.profiles("uid") on delete cascade,
  "communitySlug" text references public.communities("slug") on delete cascade,
  primary key ("userId", "communitySlug")
);

create table if not exists public.saved_posts (
  "userId" uuid references public.profiles("uid") on delete cascade,
  "postId" uuid references public.posts("id") on delete cascade,
  primary key ("userId", "postId")
);

create table if not exists public.follows (
  "followerId" uuid references public.profiles("uid") on delete cascade,
  "followingId" uuid references public.profiles("uid") on delete cascade,
  primary key ("followerId", "followingId")
);

create table if not exists public.votes (
  "id" uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.profiles("uid") on delete cascade,
  "entityType" text not null check ("entityType" in ('post', 'comment')),
  "entityId" uuid not null,
  "voteValue" integer not null check ("voteValue" in (1, -1)),
  unique ("userId", "entityType", "entityId")
);

-- Enable RLS on all tables
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

-- Setup RLS Policies

-- profiles
create policy "Public read profiles" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = "uid");

-- usernames
create policy "Public read usernames" on public.usernames for select using (true);
create policy "Profiles can insert/update their username" on public.usernames for all using (auth.uid() = "uid");

-- communities
create policy "Public read communities" on public.communities for select using (true);
create policy "Auth users can insert/update communities" on public.communities for all using (auth.role() = 'authenticated');

-- posts
create policy "Public read posts" on public.posts for select using (true);
create policy "Auth users can create posts" on public.posts for insert with check (auth.uid() = "authorUid");
create policy "Authors can update/delete their posts" on public.posts for update using (auth.uid() = "authorUid");
create policy "Anyone can update post views, score, and commentCount" on public.posts for update using (true);

-- comments
create policy "Public read comments" on public.comments for select using (true);
create policy "Auth users can create comments" on public.comments for insert with check (auth.uid() = "authorUid");
create policy "Authors can update/delete their comments" on public.comments for update using (auth.uid() = "authorUid");
create policy "Anyone can update comment score" on public.comments for update using (true);

-- leads
create policy "Public read leads" on public.leads for select using (true);
create policy "Auth users can create leads" on public.leads for insert with check (auth.uid() = "postedByUid");
create policy "Creators can update their leads" on public.leads for update using (auth.uid() = "postedByUid");

-- community_members
create policy "Public read memberships" on public.community_members for select using (true);
create policy "Users can manage their memberships" on public.community_members for all using (auth.uid() = "userId");

-- saved_posts
create policy "Users can read their own bookmarks" on public.saved_posts for select using (auth.uid() = "userId");
create policy "Users can manage their own bookmarks" on public.saved_posts for all using (auth.uid() = "userId");

-- follows
create policy "Public read follows" on public.follows for select using (true);
create policy "Users can manage their own follows" on public.follows for all using (auth.uid() = "followerId");

-- votes
create policy "Public read votes" on public.votes for select using (true);
create policy "Users can manage their own votes" on public.votes for all using (auth.uid() = "userId");


-- Setup function and trigger for user creation in Supabase auth
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_username text;
  username_exists boolean;
  display_name text;
begin
  -- Loop until we find a unique username
  loop
    new_username := 'user_' || substring(md5(random()::text) from 1 for 6);
    select exists(select 1 from public.profiles where username = new_username) into username_exists;
    if not username_exists then
      exit;
    end if;
  end loop;

  display_name := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));

  insert into public.profiles (uid, username, "displayName", initial, bio, location, website, joined, status, reputation, followers, following, "isVerifiedPro", "hasSeenVeteranCelebration", "createdAt")
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
    0,
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

-- Trigger to execute the function on auth.users insert
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seed Default Communities
insert into public.communities (slug, name, description, icon, topics, "ownerId", "memberCount", "createdAt")
values 
  ('design', 'Design', 'UI, UX, branding, illustration.', 'Palette', array['ui', 'ux', 'branding'], 'system', 0, now()),
  ('dev', 'Freelance Dev', 'Web, mobile, full-stack devs going solo.', 'Code2', array['web', 'mobile', 'backend'], 'system', 0, now()),
  ('writing', 'Writing', 'Copywriters, content writers, ghostwriters.', 'PenTool', array['copy', 'content', 'ghostwriting'], 'system', 0, now()),
  ('marketing', 'Marketing', 'Growth, SEO, paid ads, email.', 'Megaphone', array['seo', 'growth', 'ads'], 'system', 0, now()),
  ('video', 'Video & Motion', 'Editors, motion designers, animators.', 'Video', array['video', 'motion', 'animation'], 'system', 0, now()),
  ('consulting', 'Consulting', 'Strategy, ops, advisory work.', 'Briefcase', array['strategy', 'ops', 'advisory'], 'system', 0, now())
on conflict (slug) do nothing;
