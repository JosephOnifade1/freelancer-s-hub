import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MockSupabaseClient, seedMockData } from "./mockSupabase";

// Support both Vite (import.meta.env) and Next.js (process.env) conventions
const getEnv = (viteKey: string, nextKey: string): string => {
  if (typeof process !== "undefined" && process.env && process.env[nextKey]) {
    return process.env[nextKey] as string;
  }
  if (typeof process !== "undefined" && process.env && process.env[viteKey]) {
    return process.env[viteKey] as string;
  }
  try {
    // `import.meta.env` only exists in the Vite build; in the Next build the
    // `process.env` lookups above win (NEXT_PUBLIC_* is inlined at build time).
    const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    if (viteEnv && viteEnv[viteKey]) return viteEnv[viteKey] as string;
  } catch {
    // ignore
  }
  return "";
};

const supabaseUrl = getEnv("VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
const demoModeEnv = getEnv("VITE_DEMO_MODE", "NEXT_PUBLIC_DEMO_MODE");

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
