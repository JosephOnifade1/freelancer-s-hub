import { supabase } from "./supabase";

/**
 * Voting goes through the `cast_vote` SECURITY DEFINER RPC
 * (see supabase_schema.sql / supabase_architecture_hardening.sql).
 *
 * The server — never the client — reads the previous vote, computes the
 * score/ups/downs deltas, updates the post/comment, and adjusts the
 * author's reputation, all in one transaction. Clients cannot write
 * other users' reputation or arbitrary score values directly; the old
 * direct-update implementation silently failed under hardened RLS
 * policies (updates to other people's rows affect 0 rows and return
 * no error), which is why every call here surfaces errors instead.
 */

export const fetchUserVote = async (
  entityId: string,
  userId: string,
  type: "post" | "comment" = "post"
): Promise<number> => {
  const { data, error } = await supabase
    .from("votes")
    .select("voteValue")
    .eq("userId", userId)
    .eq("entityType", type)
    .eq("entityId", entityId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.voteValue ?? 0;
};

export const handleVote = async (
  entityId: string,
  authorUid: string | undefined,
  currentUserId: string,
  newVote: 1 | -1 | 0,
  type: "post" | "comment" = "post",
  _postIdForComment?: string // Kept for backward-compatibility; the RPC resolves everything server-side
) => {
  if (!currentUserId) throw new Error("Must be logged in to vote");

  // authorUid is accepted for call-site compatibility but intentionally
  // not trusted: cast_vote derives the author from the entity itself so
  // a client can't redirect reputation to (or from) an arbitrary user.
  void authorUid;

  const { error } = await supabase.rpc("cast_vote", {
    entity_id: entityId,
    entity_type: type,
    voter_uid: currentUserId,
    new_vote: newVote,
  });

  if (error) throw new Error(error.message);
};
