import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { requireEnv } from "./requireEnv";

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

export async function supaServer() {
  // Next 15 may return a Promise; await is safe across versions
  const cookieStore: any = await (cookies() as any);

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {}
      },
      remove(name: string, options?: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {}
      },
    },
  });
}



