import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MockSupabaseClient, seedMockData } from "./mockSupabase";

/**
 * Environment resolution.
 *
 * The two build systems inline environment variables differently, and both
 * require *literal* access expressions:
 *
 *  - Vite replaces `import.meta.env.VITE_*` at build time.
 *  - Next/Turbopack replaces `process.env.NEXT_PUBLIC_*` at build time.
 *
 * A dynamic read such as `process.env[key]` is NOT inlined by Next, so it
 * silently yields `undefined` in the browser bundle. Every lookup below is
 * therefore spelled out literally; nothing is read through a computed key.
 *
 * Only `NEXT_PUBLIC_*` / `VITE_*` values are referenced, so nothing here can
 * pull a server-only secret into a client bundle.
 */
const nextPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const nextPublicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const nextPublicDemoMode = readNextPublicEnv("NEXT_PUBLIC_DEMO_MODE");

const viteSupabaseUrl = readViteEnv("VITE_SUPABASE_URL");
const viteSupabaseAnonKey = readViteEnv("VITE_SUPABASE_ANON_KEY");
const viteDemoMode = readViteEnv("VITE_DEMO_MODE");

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

const supabaseUrl = nextPublicSupabaseUrl || viteSupabaseUrl || "";
const supabaseAnonKey = nextPublicSupabaseAnonKey || viteSupabaseAnonKey || "";
const demoModeEnv = nextPublicDemoMode || viteDemoMode || "";

const isPlaceholder =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes("your-supabase-project") ||
  supabaseAnonKey.includes("your-supabase-anon-key");

export const isDemoMode = demoModeEnv === "true";

let supabaseInstance: SupabaseClient;

if (isDemoMode) {
  if (typeof window !== "undefined") {
    console.info(
      "[Borynx] DEMO MODE (DEMO_MODE=true): using the local mock database. " +
        "Data is stored only in this browser and is not shared with other users."
    );
    seedMockData();
  }
  supabaseInstance = new MockSupabaseClient() as unknown as SupabaseClient;
} else if (isPlaceholder) {
  if (typeof window !== "undefined") {
    console.error(
      "[Borynx] Supabase is not configured and demo mode is off. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for a real backend, " +
        "or set NEXT_PUBLIC_DEMO_MODE=true for the local mock database."
    );
  }
  supabaseInstance = createClient("https://placeholder.supabase.co", "placeholder-anon-key");
} else {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseInstance;
