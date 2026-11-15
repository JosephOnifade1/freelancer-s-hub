/** One wire representation. Never normalize untrusted input into an authorized key. */
export const DOCUMENT_MIMES = {
  pdf: "application/pdf", txt: "text/plain", csv: "text/csv", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
export const DOCUMENT_KEY_PATTERN = `^(${uuid})/(${uuid})/(${uuid})\\.(pdf|txt|csv|doc|docx|xlsx)$`;
const pattern = new RegExp(DOCUMENT_KEY_PATTERN);
export function documentKey(path: unknown, actor?: string, post?: string) {
  if (typeof path !== "string") return null;
  const match = pattern.exec(path);
  if (!match || match[0] !== path || (actor !== undefined && match[1] !== actor) || (post !== undefined && match[2] !== post)) return null;
  return { actor: match[1], post: match[2], object: match[3], mime: DOCUMENT_MIMES[match[4] as keyof typeof DOCUMENT_MIMES] };
}
export function requireDocumentKey(path: unknown, actor?: string, post?: string) {
  const key = documentKey(path, actor, post);
  if (!key) throw new Error("invalid_document_key");
  return key;
}
