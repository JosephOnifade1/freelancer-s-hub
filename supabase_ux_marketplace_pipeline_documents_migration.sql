-- Borynx UX trust pass: account-private pipeline and REAL post documents.
-- Apply to existing projects AFTER supabase_post_interaction_hardening_migration.sql
-- and BEFORE deploying the accompanying frontend. No sample leads are copied.
-- This file is deliberately transactional: a failed policy/bucket change rolls back.
begin;

-- Personal prospect tracking is separate from public, real opportunities.
create table if not exists public.lead_pipeline (
  "id" uuid primary key default gen_random_uuid(),
  "userUid" uuid not null references public.profiles("uid") on delete cascade,
  "leadId" uuid references public.leads("id") on delete set null,
  "clientName" text not null check (length(trim("clientName")) between 1 and 120),
  "title" text not null check (length(trim("title")) between 1 and 180),
  "budget" text not null default '' check (length("budget") <= 80),
  "source" text not null default 'Manual' check (length("source") <= 80),
  "stage" text not null default 'new'
    check ("stage" in ('new', 'conversation', 'proposal', 'negotiation', 'won')),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("userUid", "leadId")
);
create index if not exists idx_lead_pipeline_user_updated
  on public.lead_pipeline ("userUid", "updatedAt" desc);
alter table public.lead_pipeline enable row level security;
grant select, insert, update, delete on public.lead_pipeline to authenticated;
drop policy if exists "Owners can read their pipeline" on public.lead_pipeline;
create policy "Owners can read their pipeline" on public.lead_pipeline
  for select to authenticated using (auth.uid() = "userUid");
drop policy if exists "Owners can add pipeline items" on public.lead_pipeline;
create policy "Owners can add pipeline items" on public.lead_pipeline
  for insert to authenticated with check (auth.uid() = "userUid");
drop policy if exists "Owners can update pipeline items" on public.lead_pipeline;
create policy "Owners can update pipeline items" on public.lead_pipeline
  for update to authenticated using (auth.uid() = "userUid") with check (auth.uid() = "userUid");
drop policy if exists "Owners can remove pipeline items" on public.lead_pipeline;
create policy "Owners can remove pipeline items" on public.lead_pipeline
  for delete to authenticated using (auth.uid() = "userUid");

-- Documents are private Storage objects; their metadata is visible only to
-- viewers of a non-deleted post. Never put members-only files in a public bucket.
create table if not exists public.post_attachments (
  "id" uuid primary key default gen_random_uuid(),
  "postId" uuid not null references public.posts("id") on delete cascade,
  "uploaderUid" uuid not null references public.profiles("uid") on delete cascade,
  "storagePath" text not null unique,
  "fileName" text not null check (length("fileName") between 1 and 255),
  "mimeType" text not null check ("mimeType" in (
    'application/pdf', 'text/plain', 'text/csv', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  "fileSize" integer not null check ("fileSize" between 1 and 10485760),
  "createdAt" timestamptz not null default now(),
  constraint attachment_path_owned check (
    split_part("storagePath", '/', 1) = "uploaderUid"::text
    and split_part("storagePath", '/', 2) = "postId"::text
  )
);
create index if not exists idx_post_attachments_post_id on public.post_attachments ("postId");
alter table public.post_attachments enable row level security;
grant select on public.post_attachments to anon, authenticated;
grant insert, delete on public.post_attachments to authenticated;
drop policy if exists "View attachments for visible posts" on public.post_attachments;
create policy "View attachments for visible posts" on public.post_attachments
  for select to anon, authenticated using (
    public.can_view_post("postId")
    and exists (select 1 from public.posts p where p.id = "postId" and p."isDeleted" is not true)
  );
drop policy if exists "Authors can attach documents to their posts" on public.post_attachments;
create policy "Authors can attach documents to their posts" on public.post_attachments
  for insert to authenticated with check (
    "uploaderUid" = auth.uid()
    and exists (select 1 from public.posts p
      where p.id = "postId" and p."authorUid" = auth.uid() and p."isDeleted" is not true)
  );
-- Serialize inserts for a post so concurrent tabs cannot evade the 3-file limit.
create or replace function public.enforce_post_document_limit()
returns trigger as $$
begin
  perform 1 from public.posts where id = new."postId" for update;
  -- SECURITY DEFINER avoids recursive RLS (storage SELECT itself checks metadata).
  if not exists (select 1 from storage.objects o
    where o.bucket_id = 'post-documents' and o.name = new."storagePath") then
    raise exception 'Upload the document before saving its details';
  end if;
  if (select count(*) from public.post_attachments where "postId" = new."postId") >= 3 then
    raise exception 'A post can have at most 3 documents';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_post_document_limit on public.post_attachments;
create trigger trg_post_document_limit before insert on public.post_attachments
  for each row execute function public.enforce_post_document_limit();

drop policy if exists "Authors can remove their attachments" on public.post_attachments;
create policy "Authors can remove their attachments" on public.post_attachments
  for delete to authenticated using ("uploaderUid" = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-documents', 'post-documents', false, 10485760,
  array['application/pdf', 'text/plain', 'text/csv', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Signed downloads require visible metadata/post; owners may also read
-- their own uploaded orphan object for cleanup if metadata creation fails.
drop policy if exists "Read documents for visible posts" on storage.objects;
create policy "Read documents for visible posts" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'post-documents' and (
      (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
      or exists (
        select 1 from public.post_attachments a
        where a."storagePath" = storage.objects.name
          and public.can_view_post(a."postId")
      )
    )
  );
drop policy if exists "Authors upload documents for their posts" on storage.objects;
create policy "Authors upload documents for their posts" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'post-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.posts p
      where p.id::text = (storage.foldername(name))[2]
        and p."authorUid" = auth.uid() and p."isDeleted" is not true)
  );
drop policy if exists "Authors delete their uploaded documents" on storage.objects;
create policy "Authors delete their uploaded documents" on storage.objects
  for delete to authenticated using (
    bucket_id = 'post-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
