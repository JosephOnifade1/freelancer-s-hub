import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseCredentials } from "@/lib/supabase-env";
/** This credential bypasses Storage RLS ONLY AFTER Neon authorization. Never expose
 * this client or its key in browser modules, responses, errors or application SQL. */
function documents() {
  const credentials = getSupabaseCredentials(),
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!credentials || !key) throw new Error("storage_not_configured");
  return createClient(credentials.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }).storage.from("post-documents");
}
export async function verifyUploadedDocument(
  path: string,
  size: number,
  mime: string,
): Promise<boolean> {
  const { data, error } = await documents().info(path);
  if (error) {
    if (String((error as { statusCode?: string }).statusCode) === "404")
      return false;
    throw new Error("storage_unavailable");
  }
  return !!data && data.size === size && data.contentType === mime;
}
export async function signDocument(
  path: string,
  fileName: string,
): Promise<string> {
  const { data, error } = await documents().createSignedUrl(path, 60, {
    download: fileName,
  });
  if (error || !data?.signedUrl) throw new Error("storage_unavailable");
  return data.signedUrl;
}
