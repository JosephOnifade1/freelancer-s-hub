-- Architecture hardening migration.
-- Apply this after the original schema to remove broad client-side mutation paths.

-- Communities: replace broad authenticated update rights with owner/admin ownership.
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

-- Posts/comments: state counters are updated through SECURITY DEFINER RPCs.
-- Do not allow arbitrary clients to update any row just to modify counters.
drop policy if exists "Anyone can update post views, score, and commentCount" on public.posts;
drop policy if exists "Anyone can update comment score" on public.comments;

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
