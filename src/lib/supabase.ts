import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { MockSupabaseClient, seedMockData } from "./mockSupabase";
import {
  isDemoMode as envIsDemoMode,
  getSupabaseCredentials,
  isSupabaseConfigured,
} from "./supabase-env";

/**
 * The browser Supabase client.
 *
 * Phase 1.1 moved credential resolution into `./supabase-env` (server-safe, no
 * browser globals) so `proxy.ts` and server utilities can read config without
 * importing this module. Everything that touches `window` lives here.
 *
 * Session storage
 * ---------------
 * `createBrowserClient` from `@supabase/ssr` — not `createClient` — stores the
 * session in **cookies** instead of `localStorage`, which is what makes the
 * session readable by the Next.js server. The migration is confined to this
 * module so no view, hook or data-layer file changed.
 *
 * Outside a browser (Next prerendering, Vitest) `@supabase/ssr`'s cookie
 * storage cannot set cookies and throws. `createClient` is therefore still used
 * when there is no `window`: prerendering then produces the signed-out shell it
 * always produced, and the client re-hydrates with cookies on the browser.
 *
 * Demo mode (browser-local mock) is unchanged: it owns its own localStorage
 * session and never installs a cookie session.
 */

export const isDemoMode = envIsDemoMode;

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
} else if (!isSupabaseConfigured) {
  if (typeof window !== "undefined") {
    console.error(
      "[Borynx] Supabase is not configured and demo mode is off. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for a real backend, " +
        "or set NEXT_PUBLIC_DEMO_MODE=true for the local mock database."
    );
  }
  supabaseInstance = createClient("https://placeholder.supabase.co", "placeholder-anon-key");
} else {
  const credentials = getSupabaseCredentials()!;
  if (typeof window === "undefined") {
    // Prerender / Vitest: no document.cookie to persist into. A plain client
    // keeps the module importable; it holds no session because nothing wrote one.
    supabaseInstance = createClient(credentials.url, credentials.anonKey);
  } else {
    // Browser: cookie-backed storage, shared with the server. `createBrowserClient`
    // is a plain static import — it is only *called* when a `window` exists, so
    // the prerender path above never touches its cookie storage.
    supabaseInstance = createBrowserClient(credentials.url, credentials.anonKey);
  }
}

export const supabase = supabaseInstance;
