import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, FileUp, Trash2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  DOCUMENT_ACCEPT, MAX_DOCUMENTS_PER_POST, fetchPostAttachments,
  getDocumentDownloadUrl, removePostAttachment, uploadPostDocuments, validateDocument,
  formatSize, isPreviewable, type PostAttachment, type DocumentUploadResult,
} from "@/lib/attachments";
import { QueryErrorState } from "@/components/QueryErrorState";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface AttachmentWithStatus extends PostAttachment {
  uploadStatus: UploadStatus;
  uploadError?: string;
}

function formatSizeDisplay(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PostAttachments({ postId, canUpload }: { postId: string; canUpload: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [fileUploadStatus, setFileUploadStatus] = useState<Record<string, UploadStatus>>({});
  const { data: attachments = [], isError, refetch } = useQuery({
    queryKey: ["postAttachments", postId], queryFn: () => fetchPostAttachments(postId), enabled: !!postId,
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    const selected = [...files];
    if (selected.length + attachments.length > MAX_DOCUMENTS_PER_POST) {
      toast.error(`A post can have up to ${MAX_DOCUMENTS_PER_POST} documents.`);
      return;
    }
    try {
      selected.forEach(validateDocument);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid document.");
      return;
    }

    setUploading(true);
    selected.forEach((f) => setFileUploadStatus((prev) => ({ ...prev, [f.name]: "uploading" })));

    try {
      const result: DocumentUploadResult = await uploadPostDocuments(postId, selected);

      // Mark each file's status.
      selected.forEach((f) => {
        const wasUploaded = result.uploaded.some((a) => a.fileName === f.name);
        setFileUploadStatus((prev) => ({
          ...prev,
          [f.name]: wasUploaded ? "success" : "error",
        }));
        if (!wasUploaded) {
          const failed = result.failed.find((fl) => fl.file.name === f.name);
          setFileUploadStatus((prev) => ({
            ...prev,
            [f.name]: "error",
          }));
          // Keep error message in a per-file map via state above is enough;
          // we also toast.
        }
      });

      if (result.uploaded.length > 0) {
        await queryClient.invalidateQueries({ queryKey: ["postAttachments", postId] });
        toast.success(`${result.uploaded.length} document${result.uploaded.length === 1 ? "" : "s"} uploaded`);
      }
      if (result.failed.length > 0) {
        result.failed.forEach((fl) => {
          toast.error(`${fl.file.name}: ${fl.error}`, { duration: 6000 });
        });
      }
    } catch (error) {
      selected.forEach((f) => setFileUploadStatus((prev) => ({ ...prev, [f.name]: "error" })));
      toast.error(error instanceof Error ? error.message : "Document upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (attachment: PostAttachment) => {
    if (!window.confirm(`Remove ${attachment.fileName} from this post?`)) return;
    setRemoving(attachment.id);
    try {
      await removePostAttachment(attachment);
      toast.success("Document removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove document");
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["postAttachments", postId] });
      setRemoving(null);
    }
  };

  const handleDownload = async (attachment: PostAttachment) => {
    try {
      setDownloading(attachment.id);
      const url = await getDocumentDownloadUrl(attachment);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.fileName;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't download this document");
    } finally {
      setDownloading(null);
    }
  };

  const clearStatus = useCallback(() => {
    setFileUploadStatus({});
  }, []);

  if (isError) return <section className="my-5" aria-label="Documents"><QueryErrorState title="Couldn't load post documents" onRetry={() => refetch()} /></section>;
  if (!attachments.length && !canUpload) return null;

  return (
    <section className="my-5 rounded-lg border border-border bg-card p-4" aria-label="Documents">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="h-4 w-4" /> Documents {attachments.length > 0 && `(${attachments.length})`}</h2>
        {canUpload && attachments.length < MAX_DOCUMENTS_PER_POST && (
          <>
            <input ref={inputRef} type="file" className="sr-only" accept={DOCUMENT_ACCEPT} multiple
              onChange={(event) => { void handleUpload(event.target.files); event.target.value = ""; }} />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || !!removing}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring">
              <FileUp className="h-4 w-4" /> {uploading ? "Uploading…" : "Add documents"}
            </button>
          </>
        )}
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No documents attached. PDF, text, CSV, Word or Excel; maximum {MAX_DOCUMENTS_PER_POST} files, 10 MB each.</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((attachment) => {
            const status = fileUploadStatus[attachment.fileName];
            const isErrorState = status === "error";
            return (
              <li key={attachment.id} className="flex min-w-0 items-center gap-2 rounded-md bg-muted/40 p-2 text-sm">
                {isPreviewable(attachment.mimeType) ? (
                  <FileText className="h-4 w-4 shrink-0 text-brand" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate text-foreground" title={attachment.fileName}>{attachment.fileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatSizeDisplay(attachment.fileSize)}</span>
                {status === "uploading" && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
                )}
                {status === "success" && (
                  <span className="h-4 w-4 shrink-0 text-emerald-600">✓</span>
                )}
                {isErrorState && (
                  <RefreshCw className="h-4 w-4 shrink-0 text-destructive cursor-pointer hover:text-destructive/80" onClick={(e) => {
                    e.stopPropagation();
                    void inputRef.current?.click();
                  }} aria-label="Retry upload" />
                )}
                <button type="button" onClick={() => handleDownload(attachment)} disabled={downloading === attachment.id}
                  aria-label={`Download ${attachment.fileName}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-brand hover:bg-muted disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring">
                  <Download className="h-4 w-4" />
                </button>
                {canUpload && <button type="button" onClick={() => handleRemove(attachment)} disabled={removing === attachment.id}
                  aria-label={`Remove ${attachment.fileName}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring">
                  <Trash2 className="h-4 w-4" />
                </button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
