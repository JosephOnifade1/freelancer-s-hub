-- OPTIONAL. Run once in the Supabase SQL Editor.
-- New profiles were created with filler values (bio "New to Borynx!", location "Earth").
-- The app now ignores those two exact values, so nothing breaks if you skip this.
-- Running it makes the data clean at the source.

alter table public.profiles alter column "bio" set default '';
alter table public.profiles alter column "location" set default '';

update public.profiles set "bio" = '' where "bio" = 'New to Borynx!';
update public.profiles set "location" = '' where "location" = 'Earth';
