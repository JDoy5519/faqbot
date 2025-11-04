// src/lib/supaClientPublic.ts
import { createClient } from "@supabase/supabase-js";

export function createPublicSupaClient(botPublicToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          "x-bot-token": botPublicToken,
        },
      },
    }
  );
}
