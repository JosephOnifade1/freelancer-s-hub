// Browser-only drafts are scoped to the signed-in account on this device.
// Files cannot survive reload in browser storage; only text and remote image URLs do.
export interface PostDraft {
  title: string;
  body: string;
  postType: "discussion" | "question" | "resource" | "poll";
  selectedTargetId: string;
  tags: string[];
  externalLink: string;
  pollOptions: string[];
  videoUrl: string;
  bodyImages: { alt: string; src: string }[];
  visibility: "public" | "members" | "admins";
  allowComments: boolean;
  pinToSpace: boolean;
  savedAt: number;
  userUid: string;
}

export const draftKey = (uid: string) => `borynx_post_draft:${uid}`;

export function readDraft(uid: string): PostDraft | null {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(draftKey(uid));
    const draft = raw ? JSON.parse(raw) as Partial<PostDraft> : null;
    if (!draft || draft.userUid !== uid || typeof draft.title !== "string" || typeof draft.body !== "string") return null;
    return {
      title: draft.title,
      body: draft.body,
      postType: ["discussion", "question", "resource", "poll"].includes(draft.postType || "") ? draft.postType! : "discussion",
      selectedTargetId: typeof draft.selectedTargetId === "string" ? draft.selectedTargetId : "",
      tags: Array.isArray(draft.tags) ? draft.tags.filter((tag): tag is string => typeof tag === "string") : [],
      externalLink: draft.externalLink || "",
      pollOptions: Array.isArray(draft.pollOptions) ? draft.pollOptions : ["Option 1", "Option 2"],
      videoUrl: draft.videoUrl || "",
      bodyImages: Array.isArray(draft.bodyImages) ? draft.bodyImages : [],
      visibility: draft.visibility || "public",
      allowComments: draft.allowComments !== false,
      pinToSpace: draft.pinToSpace === true,
      savedAt: draft.savedAt || Date.now(),
      userUid: uid,
    };
  } catch {
    return null;
  }
}

export function saveDraft(uid: string, draft: Omit<PostDraft, "savedAt" | "userUid">): void {
  if (!uid) throw new Error("Sign in before saving a draft.");
  try {
    localStorage.setItem(draftKey(uid), JSON.stringify({ ...draft, savedAt: Date.now(), userUid: uid }));
  } catch {
    throw new Error("Couldn't save on this device. Make room in browser storage or copy your text before leaving.");
  }
}

export function deleteDraft(uid: string): void {
  if (uid) localStorage.removeItem(draftKey(uid));
}
