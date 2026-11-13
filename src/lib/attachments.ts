import { supabase } from "./supabase";
import {
  fetchContentAttachments,
  isContentError,
  registerAttachment,
  removeAttachmentRecord,
} from "./content-client";

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

/**
 * Document metadata for a post.
 *
 * Phase 2D: metadata is a Neon read via `/api/content/attachments`, authorized
 * against the post's visibility *and* its deleted state — a removed post's documents
 * are no longer linked. The bytes stay in Supabase Storage; only the pointer moved.
 */
export async function fetchPostAttachments(postId: string): Promise<PostAttachment[]> {
  const result = await fetchContentAttachments(postId);
  if (isContentError(result)) {
    // A post the viewer cannot see has no visible documents; that is not an error.
    if (result.error === "not_found") return [];
    throw new Error("Could not load documents.");
  }
  return result.data as PostAttachment[];
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

      // Phase 2D: the bytes went to Storage; the pointer and metadata go to Neon.
      // The server re-derives the uploader from the session and rejects a path outside
      // `<uid>/<postId>/`, so `uploaderUid` is not sent as a claim.
      const registered = await registerAttachment({
        postId,
        storagePath: path,
        fileName: file.name,
        mimeType: mime,
        fileSize: file.size,
      });
      if (isContentError(registered)) {
        // An upload without readable metadata must not appear attached.
        await supabase.storage.from(BUCKET).remove([path]);
        throw new Error(
          registered.error === "conflict"
            ? `A post can have at most ${MAX_DOCUMENTS_PER_POST} documents.`
            : "Could not save document details.",
        );
      }
      uploaded.push(registered.data as PostAttachment);
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
  // Metadata first (Neon, uploader-scoped server-side), then the object. Removing the
  // record first means a failed cleanup cannot leave a broken download link.
  const removed = await removeAttachmentRecord(attachment.id);
  if (isContentError(removed)) {
    throw new Error(
      removed.error === "not_found"
        ? "Document not found or not removable."
        : "Could not remove this document. Please try again.",
    );
  }
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
