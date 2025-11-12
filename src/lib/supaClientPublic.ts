import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./requireEnv";

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

export function createPublicSupaClient(botPublicToken: string) {
  return createClient(url, anon, {
    global: { headers: { "x-bot-public-token": botPublicToken } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}




