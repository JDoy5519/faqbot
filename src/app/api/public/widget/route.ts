export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const js = `
(function(){
  var s = document.currentScript;
  var token = s.getAttribute("data-bot");
  var theme = s.getAttribute("data-theme") || "light";
  var color = s.getAttribute("data-color") || "#3B82F6";
  var corner = s.getAttribute("data-corner") || "right"; // left|right
  if (!token) { console.error("[faqbot] Missing data-bot token"); return; }

  var o = new URL(s.src, window.location.href).origin;
  var iframe = document.createElement("iframe");
  iframe.src = o + "/public/embed?token=" + encodeURIComponent(token)
                + "&theme=" + encodeURIComponent(theme)
                + "&color=" + encodeURIComponent(color)
                + "&corner=" + encodeURIComponent(corner);
  iframe.style.position = "fixed";
  iframe.style.border = "0";
  iframe.style.width = "360px";
  iframe.style.height = "520px";
  iframe.style.zIndex = "999999";
  iframe.style.boxShadow = "0 10px 30px rgba(0,0,0,.15)";
  iframe.style.borderRadius = "16px";
  iframe.style.bottom = "20px";
  iframe.style[corner === "left" ? "left" : "right"] = "20px";
  document.addEventListener("DOMContentLoaded", function(){ document.body.appendChild(iframe); });
})();
`;
  return new NextResponse(js, { status: 200, headers: { "content-type": "text/javascript; charset=utf-8" } });
}
