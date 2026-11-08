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
-- Voting uses cast_vote below: the server derives the author and computes
-- every delta, so clients can never write scores or reputation directly.
drop policy if exists "Anyone can update post views, score, and commentCount" on public.posts;
drop policy if exists "Anyone can update comment score" on public.comments;

create or replace function public.cast_vote(
  entity_id uuid,
  entity_type text,
  voter_uid uuid,
  new_vote integer
)
returns void as $$
declare
  previous_vote integer := 0;
  entity_author uuid;
  score_delta integer;
  ups_delta integer;
  downs_delta integer;
begin
  if auth.uid() is null or auth.uid() <> voter_uid then
    raise exception 'Not authorized to vote as another user';
  end if;

  if new_vote not in (-1, 0, 1) then
    raise exception 'Invalid vote value: %', new_vote;
  end if;

  if entity_type = 'post' then
    select "authorUid" into entity_author from public.posts where id = entity_id;
  elsif entity_type = 'comment' then
    select "authorUid" into entity_author from public.comments where id = entity_id;
  else
    raise exception 'Unsupported vote entity type: %', entity_type;
  end if;

  if entity_author is null then
    raise exception 'Vote target not found';
  end if;

  select "voteValue" into previous_vote
  from public.votes
  where "userId" = voter_uid and "entityType" = entity_type and "entityId" = entity_id;
  previous_vote := coalesce(previous_vote, 0);

  if previous_vote = new_vote then
    return;
  end if;

  if new_vote = 0 then
    delete from public.votes
    where "userId" = voter_uid and "entityType" = entity_type and "entityId" = entity_id;
  else
    insert into public.votes ("userId", "entityType", "entityId", "voteValue")
    values (voter_uid, entity_type, entity_id, new_vote)
    on conflict ("userId", "entityType", "entityId")
    do update set "voteValue" = excluded."voteValue";
  end if;

  score_delta := new_vote - previous_vote;
  ups_delta := (case when new_vote = 1 then 1 else 0 end) - (case when previous_vote = 1 then 1 else 0 end);
  downs_delta := (case when new_vote = -1 then 1 else 0 end) - (case when previous_vote = -1 then 1 else 0 end);

  if entity_type = 'post' then
    update public.posts
    set score = coalesce(score, 0) + score_delta,
        ups = coalesce(ups, 0) + ups_delta,
        downs = coalesce(downs, 0) + downs_delta
    where id = entity_id;
  else
    update public.comments
    set score = coalesce(score, 0) + score_delta,
        ups = coalesce(ups, 0) + ups_delta,
        downs = coalesce(downs, 0) + downs_delta
    where id = entity_id;
  end if;

  if entity_author <> voter_uid then
    update public.profiles
    set reputation = coalesce(reputation, 0) + score_delta
    where uid = entity_author;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- The previous apply_vote_aggregate trusted caller-supplied deltas and
-- author ids (any authenticated user could mint arbitrary score/reputation),
-- so it must not remain callable once cast_vote exists.
drop function if exists public.apply_vote_aggregate(uuid, text, uuid, uuid, integer, integer, integer);
