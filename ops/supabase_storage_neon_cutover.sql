-- Operator-applied Storage configuration, NOT a Neon/application table migration.
-- Apply together with Phase 2H deployment and server-only Storage credential.
-- No application table/function is consulted. Bucket remains PRIVATE.
-- Audit OTHER policies on this bucket before cutover: policies OR together.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('post-documents','post-documents',false,10485760,array['application/pdf','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Read documents for visible posts" on storage.objects;
drop policy if exists "Authors upload documents for their posts" on storage.objects;
drop policy if exists "Authors delete their uploaded documents" on storage.objects;
drop policy if exists "Own document bytes upload" on storage.objects;
drop policy if exists "Own document bytes read" on storage.objects;
drop policy if exists "Own document bytes delete" on storage.objects;
-- Uploader-only SELECT is needed by Storage delete/cleanup and permits reading
-- one's own bytes (including orphans), as in the old policy. Other viewers MUST
-- use server signing after Neon visibility checks. No UPDATE/upsert policy.
create policy "Own document bytes read" on storage.objects for select to authenticated
using(bucket_id='post-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Own document bytes upload" on storage.objects for insert to authenticated
with check(bucket_id='post-documents' and (storage.foldername(name))[1]=auth.uid()::text
 and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
create policy "Own document bytes delete" on storage.objects for delete to authenticated
using(bucket_id='post-documents' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
