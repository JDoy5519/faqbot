// src/lib/supaBrowser.ts
"use client";

import { createBrowserClient, type CookieOptions } from "@supabase/ssr";

function getCookie(name: string) {
  // simple cookie getter
  const match = document.cookie.split("; ").find((row) => row.startsWith(name + "="));
  return match?.split("=")[1];
}

export const supaBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      get(name: string) {
        return getCookie(name);
      },
      set(name: string, value: string, options?: CookieOptions) {
        // minimal cookie writer; SameSite=Lax so SSR can read it
        const parts = [`${name}=${value}`, "Path=/", "SameSite=Lax"];
        if (options?.maxAge) parts.push(`Max-Age=${options.maxAge}`);
        // Secure is fine on https, omit on localhost
        document.cookie = parts.join("; ");
      },
      remove(name: string, options?: CookieOptions) {
        const parts = [`${name}=`, "Path=/", "Max-Age=0", "SameSite=Lax"];
        document.cookie = parts.join("; ");
      },
    },
    auth: { persistSession: true },
  }
);
