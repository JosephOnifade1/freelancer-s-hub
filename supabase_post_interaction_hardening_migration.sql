-- ==========================================
-- BORYNX POST INTERACTION HARDENING MIGRATION
-- Run once on an existing database, AFTER
-- supabase_post_settings_and_storage_migration.sql.
--
-- What this does:
--   1. Hardens cast_vote:
--      - rejects votes on deleted posts/comments and on posts the voter
--        cannot view (can_view_post), which the SECURITY DEFINER RPC
--        previously bypassed;
--      - rejects self-votes;
--      - serializes concurrent votes by the same voter on the same
--        entity with a transaction advisory lock, so a double click /
--        second tab can no longer apply one vote twice.
--   2. Moves posts."commentCount" maintenance into a database trigger.
--      The client previously called increment_comment_count after each
--      insert (failures drifted the counter) and never decremented on
--      delete. The trigger counts non-deleted comments and reconciles
--      existing counters once, below.
--   3. Tightens comment creation: no comments on deleted posts, and a
--      reply's parent must belong to the same post.
-- ==========================================

begin;
-- Keep comment writes paused while the trigger is installed and historical
-- counters are backfilled. Otherwise an in-flight insert could be counted
-- both by the trigger and the snapshot-based backfill (or neither).
lock table public.posts, public.comments in share row exclusive mode;

-- ── 1. cast_vote: visibility / deleted / self-vote / race hardening ──
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
  entity_post_id uuid;
  entity_is_deleted boolean := false;
  parent_post_is_deleted boolean := false;
  score_delta integer;
  ups_delta integer;
  downs_delta integer;
begin
  if auth.uid() is null or auth.uid() <> voter_uid then
    raise exception 'Not authorized to vote as another user';
  end if;

  if new_vote is null or new_vote not in (-1, 0, 1) then
    raise exception 'Invalid vote value: %', new_vote;
  end if;

  -- Row locks make deletion / visibility edits and a vote serialize:
  -- once a post or comment is removed, later votes see the removed state.
  if entity_type = 'post' then
    select "authorUid", "id", coalesce("isDeleted", false)
      into entity_author, entity_post_id, entity_is_deleted
    from public.posts
    where id = entity_id
    for update;
  elsif entity_type = 'comment' then
    select c."authorUid", c."postId", coalesce(c."isDeleted", false), coalesce(p."isDeleted", false)
      into entity_author, entity_post_id, entity_is_deleted, parent_post_is_deleted
    from public.comments c
    join public.posts p on p."id" = c."postId"
    where c."id" = entity_id
    for update of c, p;
  else
    raise exception 'Unsupported vote entity type: %', entity_type;
  end if;

  if entity_author is null then
    raise exception 'Vote target not found';
  end if;

  if entity_is_deleted or parent_post_is_deleted then
    raise exception 'Cannot vote on deleted content';
  end if;

  -- SECURITY DEFINER bypasses RLS, so visibility must be checked here.
  if not public.can_view_post(entity_post_id) then
    raise exception 'Not authorized to vote on this content';
  end if;

  if entity_author = voter_uid then
    raise exception 'You cannot vote on your own content';
  end if;

  -- Serialize votes by the same voter on the same entity for the rest of
  -- this transaction; without this, two concurrent calls can both read
  -- "no previous vote" and apply the same delta twice.
  perform pg_advisory_xact_lock(
    hashtextextended(voter_uid::text || ':' || entity_type || ':' || entity_id::text, 0)
  );

  select "voteValue" into previous_vote
  from public.votes
  where "userId" = voter_uid and "entityType" = entity_type and "entityId" = entity_id
  for update;
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

-- ── 2. commentCount owned by a trigger, not the client ──────────────
create or replace function public.maintain_post_comment_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    if NEW."isDeleted" is not true then
      -- The UPDATE locks the post row: if a concurrent delete/closure wins
      -- first, the insert fails and rolls back instead of adding a reply to
      -- an already-frozen post.
      update public.posts
      set "commentCount" = coalesce("commentCount", 0) + 1
      where "id" = NEW."postId" and "isDeleted" is not true and "allowComments" is true;
      if not found then
        raise exception 'Comments are closed for this post';
      end if;
    end if;
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    if OLD."isDeleted" is not true then
      update public.posts
      set "commentCount" = greatest(0, coalesce("commentCount", 0) - 1)
      where "id" = OLD."postId";
    end if;
    return OLD;
  end if;

  -- UPDATE: moving a comment between posts (defensive; the app never
  -- does this) or soft-delete / restore transitions.
  if OLD."postId" is distinct from NEW."postId" then
    if OLD."isDeleted" is not true then
      update public.posts
      set "commentCount" = greatest(0, coalesce("commentCount", 0) - 1)
      where "id" = OLD."postId";
    end if;
    if NEW."isDeleted" is not true then
      update public.posts
      set "commentCount" = coalesce("commentCount", 0) + 1
      where "id" = NEW."postId" and "isDeleted" is not true and "allowComments" is true;
      if not found then
        raise exception 'Comments are closed for this post';
      end if;
    end if;
  elsif coalesce(OLD."isDeleted", false) <> coalesce(NEW."isDeleted", false) then
    if NEW."isDeleted" is true then
      update public.posts
      set "commentCount" = greatest(0, coalesce("commentCount", 0) - 1)
      where "id" = NEW."postId";
    else
      update public.posts
      set "commentCount" = coalesce("commentCount", 0) + 1
      where "id" = NEW."postId";
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_post_comment_count on public.comments;
create trigger trg_post_comment_count
  after insert or delete or update of "isDeleted", "postId" on public.comments
  for each row execute function public.maintain_post_comment_count();

-- Reconcile counters with the new semantics (non-deleted comments).
update public.posts p
set "commentCount" = (
  select count(*)::integer
  from public.comments c
  where c."postId" = p."id" and c."isDeleted" is not true
);

-- The client no longer calls this; the trigger above owns the counter.
drop function if exists public.increment_comment_count(uuid);

-- ── 3. Comment creation: frozen/deleted posts + same-post parents ───
drop policy if exists "Auth users can create comments" on public.comments;
create policy "Auth users can create comments" on public.comments
  for insert with check (
    auth.uid() = "authorUid"
    and public.can_view_post("postId")
    and exists (
      select 1 from public.posts p
      where p."id" = "postId" and p."allowComments" and p."isDeleted" is not true
    )
    and (
      "parentId" is null
      or exists (
        select 1 from public.comments parent
        where parent."id" = comments."parentId" and parent."postId" = comments."postId"
      )
    )
  );

commit;
