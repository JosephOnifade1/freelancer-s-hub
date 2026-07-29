import { supabase } from "./supabase";

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

// Fetches a post's poll (if it has one), including live vote counts per
// option and whether the current viewer has already voted.
export const fetchPollByPostId = async (
  postId: string,
  viewerUid?: string
): Promise<PollData | null> => {
  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("id")
    .eq("postId", postId)
    .maybeSingle();

  if (pollError || !poll) return null;

  const { data: options, error: optionsError } = await supabase
    .from("poll_options")
    .select("id, label, position")
    .eq("pollId", poll.id)
    .order("position", { ascending: true });

  if (optionsError || !options) return null;

  const { data: votes } = await supabase
    .from("poll_votes")
    .select("pollOptionId, userId")
    .eq("pollId", poll.id);

  const voteCounts: Record<string, number> = {};
  let userVoteOptionId: string | null = null;

  (votes || []).forEach((v: any) => {
    voteCounts[v.pollOptionId] = (voteCounts[v.pollOptionId] || 0) + 1;
    if (viewerUid && v.userId === viewerUid) userVoteOptionId = v.pollOptionId;
  });

  const mappedOptions: PollOption[] = options.map((o: any) => ({
    id: o.id,
    label: o.label,
    votes: voteCounts[o.id] || 0,
  }));

  return {
    id: poll.id,
    options: mappedOptions,
    totalVotes: mappedOptions.reduce((sum, o) => sum + o.votes, 0),
    userVoteOptionId,
  };
};

// Casts a vote. One vote per user per poll is enforced by a unique
// (pollId, userId) constraint in the database — this surfaces that as a
// clean error instead of a raw Postgres message.
export const votePollOption = async (pollId: string, pollOptionId: string, uid: string) => {
  const { error } = await supabase
    .from("poll_votes")
    .insert({ pollId, pollOptionId, userId: uid });

  if (error) {
    if (error.code === "23505") {
      throw new Error("You've already voted on this poll");
    }
    throw new Error(error.message);
  }
};
