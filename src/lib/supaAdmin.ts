import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./requireEnv";

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");  // same URL for client/server
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY"); // server secret

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});





