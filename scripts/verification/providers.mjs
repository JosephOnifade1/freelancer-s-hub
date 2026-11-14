import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { insist } from "./common.mjs";
export async function verifyAuth(env, output, request = fetch) {
  const response = await request(new URL("/auth/v1/settings", env.NEXT_PUBLIC_SUPABASE_URL), {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(15000), redirect: "error",
  });
  insist(response.ok, "AUTH_CONFIGURATION_UNREACHABLE");
  const settings = await response.json();
  insist(settings && typeof settings === "object" && !Array.isArray(settings) && typeof settings.external === "object", "AUTH_SETTINGS_UNEXPECTED");
  output("PASS AUTH_SETTINGS_REACHABLE; browser session/login/OAuth/provisioning NOT tested");
}
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000), redirect: "error" }) } };
export async function verifyStorage(env, options, output, makeClient = createClient, request = fetch) {
  insist(options["allow-write"] === true, "EXPLICIT_WRITE_REQUIRED");
  // Require an operator-chosen dedicated private bucket; never default to an app bucket.
  insist(typeof options.bucket === "string" && /^[a-z0-9][a-z0-9-]{2,62}$/.test(options.bucket) && !["avatars","post-images","post-documents"].includes(options.bucket), "DEDICATED_PRIVATE_TEST_BUCKET_REQUIRED");
  const prefix = options.prefix ?? "phase2i-verification";
  insist(/^phase2i-verification(?:\/[a-z0-9-]{1,40})?$/.test(prefix), "VERIFICATION_PREFIX_REQUIRED");
  const admin = makeClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
  const anon = makeClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, clientOptions);
  const bucket = await admin.storage.getBucket(options.bucket);
  insist(!bucket.error && bucket.data && bucket.data.public === false, "PRIVATE_TEST_BUCKET_UNAVAILABLE");
  const storage = admin.storage.from(options.bucket), path = `${prefix}/${randomUUID()}.txt`;
  const payload = "Borynx Phase 2I isolated verification object.\n";
  let cleanupFailed = false;
  try {
    const uploaded = await storage.upload(path, payload, { contentType: "text/plain", upsert: false });
    insist(!uploaded.error, "STORAGE_UPLOAD_FAILED");
    const found = await storage.info(path);
    insist(!found.error && found.data, "STORAGE_EXISTENCE_FAILED");
    const downloaded = await storage.download(path);
    insist(!downloaded.error && await downloaded.data.text() === payload, "STORAGE_RETRIEVAL_FAILED");
    const denied = await anon.storage.from(options.bucket).download(path);
    const status=String(denied.error?.statusCode);
    insist(!!denied.error && (["403","404"].includes(status) || status==="400" && /not found|permission|access denied|row.level/i.test(denied.error.message)), "PRIVATE_OBJECT_ANONYMOUS_ACCESS_NOT_CONFIRMED");
    // This deliberately tests the service capability, NOT application Neon authorization.
    const signed = await storage.createSignedUrl(path, 60);
    insist(!signed.error && signed.data?.signedUrl, "STORAGE_SIGNING_FAILED");
    const signedUrl=new URL(signed.data.signedUrl);
    insist(signedUrl.origin===new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin,"SIGNED_URL_ORIGIN_UNEXPECTED");
    const response=await request(signedUrl,{signal:AbortSignal.timeout(15000),redirect:"error"});
    insist(response.ok && await response.text()===payload,"SIGNED_OBJECT_RETRIEVAL_FAILED");
    output("PASS PRIVATE_STORAGE_UPLOAD_INFO_DOWNLOAD_ANON_DENIAL_SIGN_RETRIEVE; app authorization requires browser checklist");
  } finally {
    // Exact generated UUID path only, even if upload's response was lost. Never list/delete prefix.
    try {
      const removed = await storage.remove([path]);
      cleanupFailed = !!removed.error;
      if (!cleanupFailed) {
        const remains = await storage.info(path);
        cleanupFailed = !remains.error || String(remains.error.statusCode) !== "404";
      }
    } catch { cleanupFailed = true; }
    if (cleanupFailed) {
      // Generated path has no credentials/PII; safe recovery handle, no signed URL.
      output(`CLEANUP_REQUIRED generated object ${path}; inspect only this object in the approved test bucket.`);
      insist(false, "STORAGE_CLEANUP_NOT_CONFIRMED");
    }
  }
  output("PASS STORAGE_EXACT_OBJECT_CLEANUP");
}
