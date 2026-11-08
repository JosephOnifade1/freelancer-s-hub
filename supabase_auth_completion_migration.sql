-- ==========================================
-- BORYNX AUTH COMPLETION MIGRATION
-- Run once on an existing database, AFTER
-- supabase_reports_and_moderation_migration.sql.
--
-- What this does:
--   Replaces handle_new_user() so a username chosen at signup
--   (auth user metadata "username") is honored when it is
--   well-formed and still free, instead of always assigning a
--   random user_xxxxxx handle. Falls back to the generated
--   handle when the requested one is invalid or taken.
--
-- Dashboard steps that pair with this migration (Supabase
-- Dashboard → Authentication):
--   1. Enable "Confirm email" if you want verified signups.
--   2. Set Site URL to your app origin.
--   3. Add "<your-origin>/reset-password" (and "/login") to the
--      Redirect URLs allow list so confirmation and password
--      reset emails can land back in the app.
-- No table changes are needed: password reset / confirmation
-- are handled entirely by Supabase Auth.
-- ==========================================

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

-- Trigger binding is unchanged, but re-assert it idempotently.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
