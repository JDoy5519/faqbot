// src/app/public/embed/PublicEmbedClient.tsx
"use client";

import { useMemo, useState } from "react";

type Theme = "light" | "dark";
type Corner = "left" | "right";

type Source = {
  tag?: string;
  document_id?: string;
  page_start?: number | null;
  page_end?: number | null;
};

export default function PublicEmbedClient({
  token,
  theme = "light",
  color = "#3B82F6",
  corner = "right",
  topK = 6,
}: {
  token: string;
  theme?: Theme;
  color?: string;
  corner?: Corner;
  topK?: number;
}) {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; sources?: Source[] }[]
  >([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const styles = useMemo(
    () => ({
      bg: theme === "dark" ? "#0B1220" : "#FFFFFF",
      fg: theme === "dark" ? "#E5E7EB" : "#111827",
      sub: theme === "dark" ? "#9CA3AF" : "#6B7280",
      bubbleBg: theme === "dark" ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
      border: theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)",
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
          top_k: topK,
        }),
      });

      const raw = await res.text();
      let json: any;
      try {
        json = JSON.parse(raw);
      } catch {
        json = { ok: false, error: raw };
      }

      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setMessages((m) => [
        ...m,
        { role: "assistant", content: json.answer || "", sources: json.sources || [] },
      ]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Sorry — ${e?.message || "Chat failed"}` },
      ]);
    } finally {
      setLoading(false);
    }
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
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
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

            {/* Citations for assistant messages */}
            {m.role === "assistant" && m.sources?.length ? (
              <div style={{ marginTop: 4, fontSize: 11, color: styles.sub }}>
                <strong>Citations:</strong>{" "}
                {m.sources.map((s, idx) => (
                  <span key={idx} style={{ marginRight: 8 }}>
                    {(s.tag || "S") +
                      (s.document_id ? ` · ${s.document_id}` : "") +
                      (s.page_start != null
                        ? ` p.${s.page_start}${s.page_end && s.page_end !== s.page_start ? `–${s.page_end}` : ""}`
                        : "")}
                  </span>
                ))}
              </div>
            ) : null}
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
            border: `1px solid ${styles.border}`,
            padding: "10px 12px",
            fontSize: 13,
            background: styles.bg,
            color: styles.fg,
          }}
        />
        <button
          onClick={ask}
          disabled={loading || !q.trim()}
          style={{
            borderRadius: 12,
            padding: "10px 14px",
            background: color,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            opacity: loading || !q.trim() ? 0.6 : 1,
            cursor: loading || !q.trim() ? "not-allowed" : "pointer",
          }}
          aria-label="Send"
        >
          Send
        </button>
      </div>
    </div>
  );
}
