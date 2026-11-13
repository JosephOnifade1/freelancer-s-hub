/**
 * Supabase configuration, shared by the browser and the server.
 *
 * This module is the *only* place that reads Supabase credentials, and it is
 * deliberately free of `import.meta`, `window`, `localStorage` and the Supabase
 * SDK itself — so it can be imported from `proxy.ts`, Server Components and
 * route handlers as well as from the browser bundle.
 *
 * Both build systems inline environment variables differently and both require
 * *literal* access expressions:
 *
 *  - Vite replaces `import.meta.env.VITE_*` at build time.
 *  - Next/Turbopack replaces `process.env.NEXT_PUBLIC_*` at build time.
 *
 * A dynamic read such as `process.env[key]` is NOT inlined by Next, so it
 * silently yields `undefined` in the browser bundle. Every lookup below is
 * therefore spelled out literally; nothing is read through a computed key.
 *
 * Only `NEXT_PUBLIC_*` / `VITE_*` values are referenced, so nothing here can
 * pull a server-only secret into a client bundle. Privileged Storage credentials are isolated in a server-only module, never here.
 */

const nextPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const nextPublicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const nextPublicDemoMode = readNextPublicEnv("NEXT_PUBLIC_DEMO_MODE");

/**
 * `import.meta.env` only exists in the Vite build. Reading it once at module
 * scope is fine: Vite replaces it statically, and Next/Webpack leave a plain
 * property access on an object that is simply `undefined` there.
 */
const viteEnv = (
  import.meta as ImportMeta & { env?: Record<string, string | undefined> }
).env;

function readViteEnv(key: string): string | undefined {
  try {
    return viteEnv?.[key];
  } catch {
    return undefined;
  }
}

/**
 * Reads a single `NEXT_PUBLIC_*` value.
 *
 * The identifier must appear literally in the source for Next's compiler to
 * inline it — `process.env.someKey` in a variable (including a plain
 * `const x = process.env.FOO` moved into a helper) resolves to nothing. Each
 * supported variable is listed explicitly; anything else is not public config.
 */
function readNextPublicEnv(key: "NEXT_PUBLIC_DEMO_MODE"): string | undefined {
  switch (key) {
    case "NEXT_PUBLIC_DEMO_MODE":
      return process.env.NEXT_PUBLIC_DEMO_MODE;
    default:
      return undefined;
  }
}

const viteSupabaseUrl = readViteEnv("VITE_SUPABASE_URL");
const viteSupabaseAnonKey = readViteEnv("VITE_SUPABASE_ANON_KEY");
const viteDemoMode = readViteEnv("VITE_DEMO_MODE");

const supabaseUrl = nextPublicSupabaseUrl || viteSupabaseUrl || "";
const supabaseAnonKey = nextPublicSupabaseAnonKey || viteSupabaseAnonKey || "";
const demoModeEnv = nextPublicDemoMode || viteDemoMode || "";

const isPlaceholderConfig =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes("your-supabase-project") ||
  supabaseAnonKey.includes("your-supabase-anon-key");

/** Legacy demo flags no longer enable a mock identity/database backend. */
// Deprecated flags are recognized only to warn: local identities cannot authorize Neon.
if (demoModeEnv === "true") console.warn("[Borynx] Database demo mode was retired; configure Supabase Auth and Neon.");


/**
 * True when a real Supabase project is configured.
 *
 * Phase 1.1 uses this to decide whether cookie sessions are possible at all.
 * All supported runtimes use Supabase cookie sessions.
 */
export const isSupabaseConfigured = !isPlaceholderConfig;

/**
 * The public project URL and anon key, or `null` when unconfigured.
 *
 * Never log, serialise or display these values: the anon key is public by
 * design, but it is still a credential and printing it adds nothing.
 */
export function getSupabaseCredentials(): { url: string; anonKey: string } | null {
  if (!isSupabaseConfigured) return null;
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}
