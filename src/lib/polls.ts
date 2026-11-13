import { fetchContentPoll, isContentError, submitPollVote, type ContentPoll } from "./content-client";

/**
 * Polls — Neon via `/api/content/polls` (Phase 2D).
 *
 * The previous implementation made three round trips (poll, options, every vote row)
 * and tallied counts in the browser. The server now returns options with their counts
 * in one response, which also means the counts cannot be computed from rows the caller
 * was not authorized to see.
 */

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface PollData {
  id: string;
  options: PollOption[];
  totalVotes: number;
  userVoteOptionId: string | null;
}

function toPollData(poll: ContentPoll): PollData {
  return {
    id: poll.id,
    options: poll.options.map((option) => ({
      id: option.id,
      label: option.label,
      votes: option.votes,
    })),
    totalVotes: poll.totalVotes,
    userVoteOptionId: poll.viewerOptionId,
  };
}

/**
 * A post's poll, or `null` when it has none.
 *
 * `viewerUid` is no longer a parameter: the viewer is the session, resolved
 * server-side. Passing it from the browser would have let a caller see whether
 * *someone else* had voted.
 */
export const fetchPollByPostId = async (
  postId: string,
  _viewerUid?: string,
): Promise<PollData | null> => {
  const result = await fetchContentPoll(postId);
  if (isContentError(result)) {
    // A poll on a post the viewer cannot see is not an error — it is simply not there.
    if (result.error === "not_found" || result.error === "unavailable") return null;
    throw new Error("Could not load this poll.");
  }
  return result.data ? toPollData(result.data) : null;
};

/**
 * Casts a poll vote. One vote per user per poll is enforced by the unique key; a
 * repeat is reported as `already_voted` rather than a raw constraint violation.
 *
 * `uid` is kept for call-site compatibility and deliberately not used — the server
 * uses the session.
 */
export const votePollOption = async (
  pollId: string,
  pollOptionId: string,
  _uid?: string,
): Promise<void> => {
  const result = await submitPollVote(pollId, pollOptionId);

  if (isContentError(result)) {
    if (result.error === "unauthenticated") throw new Error("Sign in to vote in this poll.");
    if (result.error === "not_found") throw new Error("This poll is no longer available.");
    throw new Error(result.message || "Could not record your vote. Please try again.");
  }

  if (result.data.status === "already_voted") {
    throw new Error("You've already voted on this poll");
  }
};
