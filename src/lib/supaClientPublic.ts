// src/lib/supaClientPublic.ts
import { createClient } from "@supabase/supabase-js";

export function createPublicSupaClient(botPublicToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  // IMPORTANT: attach the x-bot-public-token header on every request
  return createClient(url, anon, {
    global: {
      headers: {
        "x-bot-public-token": botPublicToken,
      },
    },
  });
}



