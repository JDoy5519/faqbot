// src/app/api/public/widget/route.ts
export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

/**
 * Returns a JS loader that injects a floating chat iframe.
 * Usage on any site:
 *   <script>
 *     window.FAQBotWidget = { position: "right", theme: "auto", accent: "#2563EB" };
 *   </script>
 *   <script src="https://YOUR_DOMAIN/api/public/widget?token=PUBLIC_TOKEN"></script>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || searchParams.get("t") || "";
  if (!token || token.length < 8) {
    return new NextResponse("/* Missing ?token */", {
      status: 400,
      headers: { "content-type": "application/javascript; charset=utf-8" },
    });
  }

  // …above, keep your imports

type BotRowPublic = {
  id: string;
  is_active: boolean | null;
  // add other fields if you use them later (org_id, public_token, etc.)
};

const { data: botRowRaw, error } = await supabaseAdmin
  .rpc("get_bot_by_public_token", { p_token: token })
  .maybeSingle<BotRowPublic>(); // 👈 generic tells TS the shape

const botRow = botRowRaw ?? null;

if (error || !botRow || !botRow.id || botRow.is_active === false) {
  return new NextResponse("/* Invalid/disabled token */", {
    status: 404,
    headers: { "content-type": "application/javascript; charset=utf-8" },
  });
}


  // Where to load the iframe UI
  const origin = new URL(req.url).origin;
  const iframeSrc = `${origin}/public/embed?token=${encodeURIComponent(token)}`;

  const js = `
(() => {
  const cfg = (window.FAQBotWidget || {});
  const pos = (cfg.position || "right");      // "left" | "right"
  const size = (cfg.size || 520);
  const z = 2147483000; // stay above most z-index stacks

  // Host container (shadow root to avoid CSS collisions)
  const host = document.createElement("div");
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.bottom = "20px";
  host.style[pos] = "20px";
  host.style.zIndex = z;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const btn = document.createElement("button");
  btn.textContent = cfg.buttonLabel || "Chat";
  btn.style.all = "initial";
  btn.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  btn.style.fontSize = "14px";
  btn.style.padding = "10px 14px";
  btn.style.borderRadius = "999px";
  btn.style.border = "1px solid #e5e7eb";
  btn.style.background = cfg.accent || "#2563EB";
  btn.style.color = "#fff";
  btn.style.cursor = "pointer";
  btn.style.boxShadow = "0 6px 20px rgba(0,0,0,.15)";
  btn.setAttribute("aria-expanded", "false");

  const wrap = document.createElement("div");
  wrap.style.all = "initial";
  wrap.style.position = "fixed";
  wrap.style.bottom = "68px";
  wrap.style[pos] = "20px";
  wrap.style.width = size + "px";
  wrap.style.maxWidth = "95vw";
  wrap.style.height = "70vh";
  wrap.style.maxHeight = "80vh";
  wrap.style.borderRadius = "16px";
  wrap.style.overflow = "hidden";
  wrap.style.boxShadow = "0 18px 60px rgba(0,0,0,.25)";
  wrap.style.display = "none";
  wrap.style.zIndex = z;

  const iframe = document.createElement("iframe");
  iframe.src = ${JSON.stringify(iframeSrc)};
  iframe.title = "FAQBot";
  iframe.allow = "clipboard-write *; autoplay *";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.referrerPolicy = "no-referrer-when-downgrade";

  wrap.appendChild(iframe);
  shadow.appendChild(wrap);
  shadow.appendChild(btn);

  btn.addEventListener("click", () => {
    const open = wrap.style.display !== "none";
    wrap.style.display = open ? "none" : "block";
    btn.setAttribute("aria-expanded", String(!open));
  });

  // Optional programmatic open
  if (cfg.autoOpen === true) {
    wrap.style.display = "block";
    btn.setAttribute("aria-expanded", "true");
  }

  // PostMessage channel (future extensibility)
  window.addEventListener("message", (ev) => {
    if (!String(iframe.src).startsWith(ev.origin)) return;
    // noop for now
  });
})();
`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=600",
      "access-control-allow-origin": "*",
    },
  });
}
