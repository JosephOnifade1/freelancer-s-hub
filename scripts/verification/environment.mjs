import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";

// Exact names discovered in application source; no enumeration/serialization of env.
export const VARIABLES = [
  ["DATABASE_URL", true, "Neon/PostgreSQL application database"],
  ["NEXT_PUBLIC_SUPABASE_URL", true, "Next Auth/Storage project URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", true, "Next public Auth client"],
  ["SUPABASE_SERVICE_ROLE_KEY", true, "Server-only private Storage capability"],
  ["DATABASE_POOL_MAX", false, "pg pool size (default 10)"],
  ["DATABASE_SSL_CA", false, "Private CA PEM/file, normally unnecessary for Neon"],
  ["VITE_SUPABASE_URL", false, "Legacy Vite Auth project URL"],
  ["VITE_SUPABASE_ANON_KEY", false, "Legacy Vite public Auth client"],
  ["BORYNX_API_PROXY_TARGET", false, "Vite server-side API proxy"],
  ["NEXT_PUBLIC_DEMO_MODE", false, "Retired flag; must not enable mock persistence"],
  ["VITE_DEMO_MODE", false, "Retired flag; must not enable mock persistence"],
];
export function safeUrl(value, database = false) {
  try {
    const url = new URL(value);
    if (database) return ["postgres:", "postgresql:"].includes(url.protocol) && !!url.hostname && !!url.username && url.pathname.length > 1;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || local && url.protocol === "http:") && !!url.hostname && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
export function keyFormat(value, secret = false) {
  if (typeof value !== "string" || /\s|placeholder|your-|example/i.test(value)) return false;
  if (value.startsWith(secret ? "sb_secret_" : "sb_publishable_")) return value.length >= 24;
  try {
    const parts = value.split(".");
    if (parts.length !== 3 || !parts.every(p => /^[A-Za-z0-9_-]+$/.test(p))) return false;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString()).role === (secret ? "service_role" : "anon");
  } catch { return false; }
}
function valid(name, value) {
  if (name === "DATABASE_URL") return safeUrl(value, true) && !/your-|placeholder/.test(value);
  if (name.endsWith("URL") || name === "BORYNX_API_PROXY_TARGET") return safeUrl(value) && !/your-|placeholder/.test(value);
  if (name.endsWith("ANON_KEY")) return keyFormat(value);
  if (name === "SUPABASE_SERVICE_ROLE_KEY") return keyFormat(value, true);
  if (name === "DATABASE_POOL_MAX") return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
  if (name.endsWith("DEMO_MODE")) return value === "false";
  if (name === "DATABASE_SSL_CA") {
    try { const pem = value.includes("-----BEGIN") ? value : readFileSync(value, "utf8"); new X509Certificate(pem); return true; } catch { return false; }
  }
  return false;
}
export function inspectEnvironment(env) {
  const rows = VARIABLES.map(([name, required, purpose]) => ({ name, required, purpose,
    state: !env[name] ? "MISSING" : valid(name, env[name]) ? "PRESENT" : "INVALID" }));
  // Mixed project pairs can silently connect the legacy and Next apps to different identities.
  if (env.VITE_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL && env.VITE_SUPABASE_URL !== env.NEXT_PUBLIC_SUPABASE_URL)
    rows.find(r => r.name === "VITE_SUPABASE_URL").state = "INVALID";
  return rows;
}
export function environmentOkay(rows) { return rows.every(r => r.state === "PRESENT" || !r.required && r.state === "MISSING"); }
