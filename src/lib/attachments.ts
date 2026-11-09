import { supabase } from "./supabase";

export interface PostAttachment {
  id: string;
  postId: string;
  uploaderUid: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface DocumentUploadResult {
  uploaded: PostAttachment[];
  failed: { file: File; error: string }[];
}

const BUCKET = "post-documents";
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_POST = 3;
export const DOCUMENT_ACCEPT = ".pdf,.txt,.csv,.doc,.docx,.xlsx";

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function validateDocument(file: File): { extension: string; mime: string } {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime || (file.type && file.type !== mime && file.type !== "application/octet-stream" && !(extension === "csv" && file.type === "application/vnd.ms-excel"))) {
    throw new Error("Choose a PDF, text, CSV, Word or Excel document.");
  }
  if (!file.size || file.size > MAX_DOCUMENT_SIZE) {
    throw new Error("Each document must be between 1 byte and 10 MB.");
  }
  if (!file.name || file.name.length > 255) {
    throw new Error("Document names must be 1–255 characters.");
  }
  return { extension, mime };
}

export async function fetchPostAttachments(postId: string): Promise<PostAttachment[]> {
  const { data, error } = await supabase.from("post_attachments").select("*")
    .eq("postId", postId).order("createdAt", { ascending: true });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not load documents.");
  return data as PostAttachment[];
}

/**
 * Upload documents one at a time, independently. A failure on one file
 * never blocks the others. Returns what succeeded and what failed so the
 * caller can show per-file status instead of an all-or-nothing error.
 */
export async function uploadPostDocuments(postId: string, files: File[]): Promise<DocumentUploadResult> {
  if (!postId) throw new Error("Save the post before uploading documents.");
  if (!files.length || files.length > MAX_DOCUMENTS_PER_POST) {
    throw new Error(`Select 1–${MAX_DOCUMENTS_PER_POST} documents.`);
  }
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const uid = session?.session?.user?.id;
  if (!uid) throw new Error("Sign in before attaching documents.");

  const uploaded: PostAttachment[] = [];
  const failed: { file: File; error: string }[] = [];

  // Enforce the per-post cap against documents already attached, so a
  // retry or a second upload can't push a post over the limit even when
  // each batch is small. Independent per-file results still apply within
  // a batch that passes the cap.
  const existing = await fetchPostAttachments(postId);
  if (existing.length + files.length > MAX_DOCUMENTS_PER_POST) {
    throw new Error(`A post can have at most ${MAX_DOCUMENTS_PER_POST} documents.`);
  }

  for (const file of files) {
    try {
      const { extension, mime } = validateDocument(file);
      const path = `${uid}/${postId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const { data, error } = await supabase.from("post_attachments").insert({
        postId, uploaderUid: uid, storagePath: path,
        fileName: file.name, fileSize: file.size, mimeType: mime,
      }).select("*").single();
      if (error || !data) {
        // An upload without readable metadata must not appear attached.
        await supabase.storage.from(BUCKET).remove([path]);
        throw new Error(error?.message || "Could not save document details.");
      }
      uploaded.push(data as PostAttachment);
    } catch (error) {
      failed.push({ file, error: error instanceof Error ? error.message : "Upload failed" });
    }
  }

  return { uploaded, failed };
}

/** Private bucket: URLs are short-lived, never stored in a public post. */
export async function getDocumentDownloadUrl(attachment: PostAttachment): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET)
    .createSignedUrl(attachment.storagePath, 60, { download: attachment.fileName });
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Could not prepare this download.");
  return data.signedUrl;
}

/** Remove metadata first so a cleanup failure cannot leave a broken download link. */
export async function removePostAttachment(attachment: PostAttachment): Promise<void> {
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const uid = session?.session?.user?.id;
  if (!uid || uid !== attachment.uploaderUid) throw new Error("Only the uploader can remove this document.");
  const { data, error } = await supabase.from("post_attachments")
    .delete().eq("id", attachment.id).eq("uploaderUid", uid).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Document not found or not removable.");
  const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([attachment.storagePath]);
  if (cleanupError) throw new Error("Document removed from the post, but file cleanup failed. Please contact support.");
}

/** Human-readable file size. */
export function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Whether a document type can be previewed inline (text/CSV). */
export function isPreviewable(mimeType: string): boolean {
  return mimeType === "text/plain" || mimeType === "text/csv";
}
