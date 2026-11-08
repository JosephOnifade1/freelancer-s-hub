import { supabase } from "./supabase";

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

  const { data } = await supabase.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) throw new Error("You need to be signed in to upload images.");

  const rawExt = file.name.split(".").pop() || "png";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error("Upload finished but no URL was returned.");
  return urlData.publicUrl as string;
}
