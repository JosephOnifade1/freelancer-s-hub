import { createClient } from "@supabase/supabase-js";
import { MockSupabaseClient, seedMockData } from "./mockSupabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const isPlaceholder =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes("your-supabase-project") ||
  supabaseAnonKey.includes("your-supabase-anon-key");

let supabaseInstance: any;

if (isPlaceholder) {
  console.info(
    "[Borynx] Supabase credentials not configured. Using local mock database. " +
    "To connect to a real backend, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file."
  );
  // Seed mock data on first load
  seedMockData();
  supabaseInstance = new MockSupabaseClient();
} else {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseInstance;

