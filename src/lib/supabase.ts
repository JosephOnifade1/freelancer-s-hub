import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MockSupabaseClient, seedMockData } from "./mockSupabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const useMockSupabase = import.meta.env.VITE_USE_MOCK_SUPABASE === "true";

const isPlaceholder =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes("your-supabase-project") ||
  supabaseAnonKey.includes("your-supabase-anon-key");

type AppSupabaseClient = SupabaseClient | MockSupabaseClient;

let supabaseInstance: AppSupabaseClient;

if (isPlaceholder && !useMockSupabase) {
  throw new Error(
    "Supabase credentials are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, " +
      "or set VITE_USE_MOCK_SUPABASE=true for local mock development."
  );
}

if (useMockSupabase) {
  console.info(
    "[Borynx] VITE_USE_MOCK_SUPABASE=true. Using local mock database. " +
      "Do not enable this in production."
  );
  seedMockData();
  supabaseInstance = new MockSupabaseClient();
} else {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseInstance;
