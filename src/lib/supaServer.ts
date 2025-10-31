// src/lib/supaServer.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
// If you have generated DB types, you can do: createServerClient<Database>(...)

export async function supaServer() {
  // In Next 15+, cookies() can be async -> returns a Promise
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: CookieOptions) {
          try {
            // Next 15 supports the object form
            cookieStore.set({ name, value, ...options });
          } catch {
            // Some contexts (e.g., certain RSC/Edge paths) can’t set cookies
          }
        },
        remove(name: string, options?: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Same note as above
          }
        },
      },
    }
  );
}


