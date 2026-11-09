-- ============================================================
-- BORYNX — Reports & Moderation (Trust Pack) Migration
-- Run once in the Supabase SQL Editor (safe to re-run).
--
-- What this adds:
--   1. A real `reports` table (replacing toast-only "Report" buttons).
--      Users file reports; moderators/admins work the queue.
--   2. `moderate_report` RPC: resolve/dismiss a report and optionally
--      remove the reported content, atomically, moderators only.
--   3. Governed Verified Pro + roles: `set_user_verified_pro` and
--      `set_user_role` RPCs (admin only). Until now Verified Pro could
--      only be granted by hand-editing the database, and profile RLS
--      (correctly) stops admins editing other users' rows directly.
--
-- 1b. Extend reason CHECK constraint for new report reasons
-- (Existing projects that already applied this migration need this step.)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'reports_reason_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports drop constraint reports_reason_check;
  end if;
  alter table public.reports
    add constraint reports_reason_check
    check ("reason" in ('spam', 'harassment', 'scam', 'inappropriate', 'hate_speech', 'misinformation', 'copyright', 'nsfw', 'other'));
end $$;

-- Bootstrap your first admin afterwards, e.g.:
--   update public.profiles set "role" = 'admin'
--   where "username" = 'your_handle';
-- ============================================================


-- 1. Reports table ------------------------------------------------
create table if not exists public.reports (
  "id" uuid primary key default gen_random_uuid(),
  "reporterUid" uuid not null references public.profiles("uid") on delete cascade,
  "entityType" text not null check ("entityType" in ('post', 'comment', 'lead', 'profile')),
  "entityId" uuid not null,
  "reason" text not null check ("reason" in ('spam', 'harassment', 'scam', 'inappropriate', 'hate_speech', 'misinformation', 'copyright', 'nsfw', 'other')),
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


-- 2. Reports RLS ----------------------------------------------------
alter table public.reports enable row level security;

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

-- No client DELETE policy: reports are an audit trail.

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
