

/**
 * Image uploads to Supabase Storage (buckets: `avatars`, `post-images`).
 *
 * Files land under "<uid>/<timestamp>-<rand>.<ext>" so the storage RLS
 * policies (own-folder writes only) hold, and the public URL is what gets
 * stored in profiles.avatarUrl / post markdown. Before this, avatars and
 * post images were base64 data URLs stuffed into database text columns.
 *
 * In demo mode the mock client implements the same storage API with
 * localStorage-backed data URLs, so callers don't branch.
 */

export type UploadBucket = "avatars" | "post-images";

const LIMITS: Record<UploadBucket, number> = {
  avatars: 2 * 1024 * 1024,
  "post-images": 5 * 1024 * 1024,
};

export async function uploadImage(file: File, bucket: UploadBucket): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  const limit = LIMITS[bucket];
  if (file.size > limit) {
    throw new Error(`Image must be smaller than ${Math.round(limit / (1024 * 1024))}MB.`);
  }

  const body = new FormData(); body.set("bucket", bucket); body.set("file", file);
  const response = await fetch("/api/storage/objects", { method: "POST", body, credentials: "same-origin" });
  if (!response.ok) throw new Error("Could not upload image. Please retry.");
  const result = await response.json();
  if (!result.url) throw new Error("Upload did not return an image reference.");
  return result.url;
}
