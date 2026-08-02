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

  // 2. Update entity score/ups/downs in the appropriate table
  const table = type === "post" ? "posts" : "comments";
  const { data: entity } = await supabase
    .from(table)
    .select("score, ups, downs")
    .eq("id", entityId)
    .single();

  if (entity) {
    await supabase
      .from(table)
      .update({
        score: (entity.score || 0) + diff,
        ups: (entity.ups || 0) + upDiff,
        downs: (entity.downs || 0) + downDiff,
      })
      .eq("id", entityId);
  }

  // 3. Update author reputation
  if (authorUid && authorUid !== currentUserId) {
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("reputation")
      .eq("uid", authorUid)
      .single();

    if (authorProfile) {
      await supabase
        .from("profiles")
        .update({ reputation: (authorProfile.reputation || 0) + diff })
        .eq("uid", authorUid);
    }
  }
};
