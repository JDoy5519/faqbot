"use client"; // must be first

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function EmbedPage() {
  const sp = useSearchParams();

  const token = sp.get("token") || "";
  const theme = sp.get("theme") || "light";
  const color = sp.get("color") || "#3B82F6";
  const corner = sp.get("corner") || "right";

  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const styles = useMemo(
    () => ({
      bg: theme === "dark" ? "#0B1220" : "#FFFFFF",
      fg: theme === "dark" ? "#E5E7EB" : "#111827",
      sub: theme === "dark" ? "#9CA3AF" : "#6B7280",
      bubbleBg: theme === "dark" ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
    }),
    [theme]
  );

  async function ask() {
    const text = q.trim();
    if (!text || !token) return;
    setQ("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bot_public_token: token,
          messages: [{ role: "user", content: text }],
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Chat failed");
      setMessages((m) => [...m, { role: "assistant", content: j.answer }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Sorry — ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <div style={{ padding: 16, fontSize: 12 }}>Missing token</div>;
  }

  return (
    <div
      style={{
        background: styles.bg,
        color: styles.fg,
        width: "100%",
        height: "100%",
        padding: 12,
        boxSizing: "border-box",
        borderRadius: 16,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Help Assistant</div>
      <div style={{ fontSize: 12, color: styles.sub, marginBottom: 12 }}>Ask a question below</div>

      <div style={{ height: 360, overflow: "auto", paddingRight: 4 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ textAlign: m.role === "user" ? "right" : "left", marginBottom: 8 }}>
            <span
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: 14,
                background: m.role === "user" ? color : styles.bubbleBg,
                color: m.role === "user" ? "white" : styles.fg,
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && <div style={{ fontSize: 12, color: styles.sub }}>Thinking…</div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Type your question…"
          style={{
            flex: 1,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,.1)",
            padding: "10px 12px",
            fontSize: 13,
            background: styles.bg,
            color: styles.fg,
          }}
        />
        <button
          onClick={ask}
          disabled={loading}
          style={{
            borderRadius: 12,
            padding: "10px 14px",
            background: color,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

