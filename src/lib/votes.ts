import { fetchOwnVote, isContentError, submitVote } from "./content-client";

/**
 * Voting — Neon via `/api/content/votes` (Phase 2D).
 *
 * The `cast_vote` RPC is gone; `castVote` in `content-queries.ts` reproduces it,
 * including the advisory lock, the previous-vote delta, the counter update and the
 * author reputation adjustment, all in one transaction.
 *
 * Two signature changes, both deliberate:
 *
 *  - `currentUserId` is **ignored**. The voter is the verified session, so a caller
 *    cannot vote as someone else by passing a different id. The parameter is kept so
 *    the call sites in `VoteControls` do not change.
 *  - `authorUid` was already ignored by the RPC (`void authorUid`); the server derives
 *    the author from the entity, which is what stopped reputation being redirected.
 *    That is unchanged.
 */

export const fetchUserVote = async (
  entityId: string,
  _userId: string,
  type: "post" | "comment" = "post",
): Promise<number> => {
  const result = await fetchOwnVote(type, entityId);
  if (isContentError(result)) {
    // A missing vote is 0. A failed lookup must not render as "you upvoted", so a
    // real error propagates instead of being flattened into the same value.
    if (result.error === "unauthenticated") return 0;
    throw new Error("Could not load your vote.");
  }
  return result.data;
};

export const handleVote = async (
  entityId: string,
  _authorUid: string | undefined,
  _currentUserId: string,
  newVote: 1 | -1 | 0,
  type: "post" | "comment" = "post",
  _postIdForComment?: string,
): Promise<void> => {
  const result = await submitVote(type, entityId, newVote);

  if (isContentError(result)) {
    switch (result.error) {
      case "unauthenticated":
        throw new Error("Must be logged in to vote");
      case "forbidden":
        // The server distinguishes a self-vote from a generic refusal by message.
        throw new Error(result.message || "You cannot vote on your own content");
      case "not_found":
        throw new Error("That content is no longer available.");
      default:
        throw new Error(result.message || "Could not record your vote. Please try again.");
    }
  }

  if (result.data.status === "self_vote") {
    throw new Error("You cannot vote on your own content");
  }
  if (result.data.status === "deleted_content") {
    throw new Error("Cannot vote on deleted content");
  }
};
