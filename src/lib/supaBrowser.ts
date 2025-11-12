"use client";

import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import { requireEnv } from "./requireEnv";

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

function getCookie(name: string) {
  const match = document.cookie.split("; ").find((row) => row.startsWith(name + "="));
  return match?.split("=")[1];
}

export const supaBrowser = createBrowserClient(url, anon, {
  cookies: {
    get(name: string) {
      return getCookie(name);
    },
    set(name: string, value: string, options?: CookieOptions) {
      const parts = [`${name}=${value}`, "Path=/", "SameSite=Lax"];
      if (options?.maxAge) parts.push(`Max-Age=${options.maxAge}`);
      if (location.protocol === "https:") parts.push("Secure");
      document.cookie = parts.join("; ");
    },
    remove(name: string, options?: CookieOptions) {
      const parts = [`${name}=`, "Path=/", "Max-Age=0", "SameSite=Lax"];
      if (location.protocol === "https:") parts.push("Secure");
      document.cookie = parts.join("; ");
    },
  },
  auth: { persistSession: true },
});

