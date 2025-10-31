import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("Missing env: SUPABASE_URL");
if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

// Server-side admin client (Service Role). Never import this in client components.
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { "X-Client-Info": "faqbot-admin" } },
});

