-- ============================================================
-- BORYNX — Lead Applications Migration
-- Run once in the Supabase SQL Editor (safe to re-run).
--
-- Replaces the previously simulated "Apply Now" flow (a setTimeout and a
-- toast) with a real applications pipeline:
--   freelancer applies -> row in lead_applications -> lead owner reviews
--   it in the Applications inbox -> accept / reject -> applicant sees the
--   status and can withdraw.
-- leads."applicantsCount" is maintained by trigger, never by the client.
-- ============================================================


-- 1. Table ----------------------------------------------------
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

create index if not exists idx_lead_applications_leadId
  on public.lead_applications ("leadId");
create index if not exists idx_lead_applications_applicantUid
  on public.lead_applications ("applicantUid");


-- 2. Row Level Security ----------------------------------------
alter table public.lead_applications enable row level security;

-- Read: the applicant, or the owner of the lead being applied to.
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

-- Create: only for yourself, only on someone else's OPEN lead.
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

-- Update: applicant (withdraw) or lead owner (review). The trigger in
-- section 3 restricts WHICH columns each side may actually change —
-- RLS alone is row-level and cannot express that.
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

-- No delete policy: applications are withdrawn (status), never deleted,
-- so both sides keep an audit trail.


-- 3. Column-level guard + updatedAt ----------------------------
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

-- Backfill counts from whatever applications already exist.
update public.leads l
set "applicantsCount" = (
  select count(*) from public.lead_applications a
  where a."leadId" = l."id" and a."status" <> 'withdrawn'
);
