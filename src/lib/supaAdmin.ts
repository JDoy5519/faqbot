import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!process.env.SUPABASE_SERVICE_ROLE) throw new Error("Missing SUPABASE_SERVICE_ROLE");

export const supaAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false }, global: { headers: { "X-Client-Info": "faqbot-admin" } } }
);

