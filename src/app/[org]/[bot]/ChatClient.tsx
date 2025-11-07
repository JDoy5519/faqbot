"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithQuotaToast } from "@/lib/fetchWithQuotaToast";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };
type Props = { botPublicToken: string; accent?: string; citeOn?: boolean };

export default function ChatClient({ botPublicToken, accent = "#3B82F6", citeOn = true }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask() {
    const text = q.trim();
    if (!text || loading) return;

    setQ("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetchWithQuotaToast("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bot_public_token: botPublicToken,
          messages: [{ role: "user", content: text }],
          top_k: 6,
        }),
        onWarn: (msg) => toast(msg), // e.g. "80% used (160000/200000)"
      });

      // Hard stop at quota
      if (res.status === 402) {
        const j = await res.json().catch(() => ({} as any));
        const msg = j?.error || "You’ve hit your monthly limit — upgrade to keep going.";
        toast(msg);
        setMessages((m) => [...m, { role: "assistant", content: `Heads up — ${mdSafe(msg)}` }]);
        return;
      }

      // Other non-OK cases
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any));
        throw new Error(j?.error || `Request failed (${res.status})`);
      }

      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Chat failed");

      setMessages((m) => [...m, { role: "assistant", content: formatAnswer(j.answer, citeOn) }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Sorry — ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-[60vh] overflow-auto pr-2">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className="inline-block rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap"
              style={{
                background: m.role === "user" ? accent : "rgba(0,0,0,0.04)",
                color: m.role === "user" ? "white" : undefined,
              }}
              // Lightweight renderer — swap for a real MD renderer later
              dangerouslySetInnerHTML={{ __html: mdSafe(m.content) }}
            />
          </div>
        ))}
        {loading && <div className="text-sm text-[#6B7280]">Thinking…</div>}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border px-3 py-2 text-sm"
          placeholder="Type your question…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask();
          }}
        />
        <button
          className="rounded-xl px-4 py-2 text-sm text-white"
          style={{ background: accent }}
          onClick={ask}
          disabled={loading}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function formatAnswer(answer: string, citeOn: boolean) {
  if (!citeOn) return answer.replace(/\n?Sources:.*$/is, "").trim();
  return answer;
}

function mdSafe(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/\n/g, "<br/>");
}

