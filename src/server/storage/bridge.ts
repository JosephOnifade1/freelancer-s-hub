import "server-only";
import { createClient } from "@supabase/supabase-js";
/** Transitional Supabase STORAGE capability only. Better Auth is the sole identity
 * provider. Callers must authorize in Neon before invoking these privileged methods.
 * No R2 implementation or provider policy mutation in Phase 2I-B. */
export function storageBucket(bucket: "avatars" | "post-images" | "post-documents") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("storage_unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage.from(bucket);
}
