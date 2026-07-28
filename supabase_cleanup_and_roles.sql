-- ============================================================
-- BORYNX — Cleanup + Roles Migration
-- Run each numbered section separately in the Supabase SQL Editor,
-- reading the comments before you run it. Sections 3 and 4 delete
-- data — review the SELECT output first before running the DELETE
-- right below it.
-- ============================================================


-- ============================================================
-- 1. Add the role column (safe to run even if it already exists)
-- ============================================================
alter table public.profiles
  add column if not exists "role" text default 'member';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check ("role" in ('admin', 'moderator', 'member'));

update public.profiles set "role" = 'member' where "role" is null;


-- ============================================================
-- 2. Wipe all post/comment/vote/interaction data.
-- This does NOT touch profiles or auth users — safe to run any
-- time you want a clean content slate without losing accounts.
-- ============================================================
truncate table public.votes cascade;
truncate table public.saved_posts cascade;
truncate table public.comments cascade;
truncate table public.posts cascade;


-- ============================================================
-- 3. Review which profiles currently exist before deciding
-- whether to delete any of them. RUN THIS FIRST, read the output.
-- ============================================================
select
  p."uid",
  p."username",
  p."displayName",
  p."role",
  u.email,
  p."createdAt"
from public.profiles p
left join auth.users u on u.id = p."uid"
order by p."createdAt" desc;


-- ============================================================
-- 4. DANGER ZONE — delete specific junk profiles.
-- Only after reviewing section 3's output. Replace the uid list
-- below with the actual "uid" values you want gone (copy them from
-- the query above). This cascades to their posts/comments/votes/
-- memberships automatically (schema uses ON DELETE CASCADE).
--
-- Deleting from auth.users is what actually removes the account —
-- deleting only from public.profiles will leave an orphaned auth
-- user that the trigger will NOT recreate a profile for.
-- ============================================================
-- delete from auth.users where id in (
--   'uuid-of-junk-user-1',
--   'uuid-of-junk-user-2'
-- );


-- ============================================================
-- 5. After creating your 5 real test users via the Supabase
-- Dashboard (Authentication → Users → Add User), run this to see
-- them and confirm the auto-profile trigger created their rows.
-- ============================================================
select "uid", "username", "displayName", "role"
from public.profiles
order by "createdAt" desc
limit 10;


-- ============================================================
-- 6. Assign roles + clean display names to your 5 test users.
-- Match by email since that's what you'll recognize from the
-- dashboard. Edit the emails/roles/names below to match what you
-- actually created, then run.
-- ============================================================
-- update public.profiles p
-- set "role" = 'admin', "displayName" = 'Joseph (Admin)'
-- from auth.users u
-- where u.id = p."uid" and u.email = 'admin-test@yourdomain.com';

-- update public.profiles p
-- set "role" = 'moderator', "displayName" = 'Test Moderator'
-- from auth.users u
-- where u.id = p."uid" and u.email = 'mod-test@yourdomain.com';

-- update public.profiles p
-- set "role" = 'member', "displayName" = 'Test Member 1'
-- from auth.users u
-- where u.id = p."uid" and u.email = 'member1-test@yourdomain.com';

-- update public.profiles p
-- set "role" = 'member', "displayName" = 'Test Member 2'
-- from auth.users u
-- where u.id = p."uid" and u.email = 'member2-test@yourdomain.com';

-- update public.profiles p
-- set "role" = 'member', "displayName" = 'Test Member 3'
-- from auth.users u
-- where u.id = p."uid" and u.email = 'member3-test@yourdomain.com';
