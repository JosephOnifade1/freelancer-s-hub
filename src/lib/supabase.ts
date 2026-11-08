import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MockSupabaseClient, seedMockData } from "./mockSupabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const isPlaceholder =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes("your-supabase-project") ||
  supabaseAnonKey.includes("your-supabase-anon-key");

/**
 * Demo mode is EXPLICIT opt-in: VITE_DEMO_MODE=true.
 *
 * Previously, missing credentials silently swapped in a seeded localStorage
 * mock database. That made a misconfigured production deploy look alive
 * while every user's data lived only in their own browser. Now:
 *  - VITE_DEMO_MODE=true          → mock DB (instant preview, fake data)
 *  - real credentials configured  → real Supabase
 *  - anything else                → a deliberately unreachable client, so
 *    auth/data calls fail visibly (console error + UI error states)
 *    instead of pretending demo content is real.
 */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

let supabaseInstance: SupabaseClient;

if (isDemoMode) {
  console.info(
    "[Borynx] DEMO MODE (VITE_DEMO_MODE=true): using the local mock database. " +
      "Data is stored only in this browser and is not shared with other users."
  );
  // Seed mock data on first load
  seedMockData();
  supabaseInstance = new MockSupabaseClient() as unknown as SupabaseClient;
} else if (isPlaceholder) {
  console.error(
    "[Borynx] Supabase is not configured and demo mode is off. " +
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for a real backend, " +
      "or set VITE_DEMO_MODE=true for the local mock database."
  );
  supabaseInstance = createClient("https://placeholder.supabase.co", "placeholder-anon-key");
} else {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseInstance;
