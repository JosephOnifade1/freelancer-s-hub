import { supabase } from "./supabase";

export const fetchUserVote = async (
  entityId: string,
  userId: string,
  type: "post" | "comment" = "post"
): Promise<number> => {
  const { data } = await supabase
    .from("votes")
    .select("voteValue")
    .eq("userId", userId)
    .eq("entityType", type)
    .eq("entityId", entityId)
    .single();

  return data?.voteValue ?? 0;
};

export const handleVote = async (
  entityId: string,
  authorUid: string | undefined,
  currentUserId: string,
  newVote: 1 | -1 | 0,
  type: "post" | "comment" = "post",
  _postIdForComment?: string // Kept for backward-compatibility, not needed in Supabase
) => {
  if (!currentUserId) throw new Error("Must be logged in to vote");

  // Fetch the current vote for this user
  const { data: existingVote } = await supabase
    .from("votes")
    .select("voteValue")
    .eq("userId", currentUserId)
    .eq("entityType", type)
    .eq("entityId", entityId)
    .single();

  const previousVote: number = existingVote?.voteValue ?? 0;
  if (previousVote === newVote) return;

  const diff = newVote - previousVote;
  const upDiff = (newVote === 1 ? 1 : 0) - (previousVote === 1 ? 1 : 0);
  const downDiff = (newVote === -1 ? 1 : 0) - (previousVote === -1 ? 1 : 0);

  // 1. Upsert or delete vote record
  if (newVote === 0) {
    await supabase
      .from("votes")
      .delete()
      .eq("userId", currentUserId)
      .eq("entityType", type)
      .eq("entityId", entityId);
  } else {
    await supabase.from("votes").upsert({
      userId: currentUserId,
      entityType: type,
      entityId: entityId,
      voteValue: newVote,
    });
  }

  // 2. Update aggregate counters through a backend RPC. This keeps score,
  // ups, downs, and reputation changes out of broad client-side update RLS.
  const { error } = await supabase.rpc("apply_vote_aggregate", {
    entity_id: entityId,
    entity_type: type,
    author_uid: authorUid ?? null,
    voter_uid: currentUserId,
    score_delta: diff,
    ups_delta: upDiff,
    downs_delta: downDiff,
  });

  if (error) throw new Error(error.message || "Failed to update vote totals");
};
