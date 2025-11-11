// src/lib/useChatClient.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithQuotaToast } from "@/lib/fetchWithQuotaToast";

export type ChatCitation = {
  tag?: string;            // your 'sources[].tag'
  document_id?: string;
  page_start?: number | null;
  page_end?: number | null;
  title?: string;          // optional future field
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  citations?: ChatCitation[];
};

type SendParams = { text: string; botId: string; topK?: number };

export function useChatClient(initialConversationId?: string) {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const mounted = useRef(false);

  // simple local persistence (optional)
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    try {
      const cached = localStorage.getItem("faqbot:lastChat");
      if (cached) {
        const parsed = JSON.parse(cached);
        setConversationId(parsed.conversationId ?? undefined);
        setMessages(parsed.messages ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("faqbot:lastChat", JSON.stringify({ conversationId, messages }));
    } catch {}
  }, [conversationId, messages]);

  async function send({ text, botId, topK = 6 }: SendParams) {
    if (!text.trim()) return;
    setSending(true);

    const optimistic: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      // *** Your existing API shape ***
      const res = await fetchWithQuotaToast("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          messages: [{ role: "user", content: text }],
          top_k: topK,
          conversation_id: conversationId ?? null, // harmless if your route ignores it
        }),
      });

      const ct = res.headers.get("content-type") || "";
      const raw = await res.text();
      const json = ct.includes("application/json") ? JSON.parse(raw) : { ok: false, error: raw };

      if (!json.ok) throw new Error(json.error || "Chat failed");

      // Normalise your sources -> citations
      const citations: ChatCitation[] = Array.isArray(json.sources)
        ? json.sources.map((s: any) => ({
            tag: s.tag,
            document_id: s.document_id,
            page_start: s.page_start ?? null,
            page_end: s.page_end ?? null,
          }))
        : [];

      const assistant: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: json.answer || "",
        created_at: new Date().toISOString(),
        citations,
      };

      setMessages((m) => [...m, assistant]);

      // Optional: if backend returns a conversation_id later, adopt it
      if (json.conversation_id && !conversationId) setConversationId(json.conversation_id);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `⚠ ${e?.message || "Chat failed"}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function resetConversation() {
    setConversationId(undefined);
    setMessages([]);
  }

  return { conversationId, messages, sending, send, resetConversation };
}

