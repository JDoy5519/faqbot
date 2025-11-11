// src/lib/useChatClient.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithQuotaToast } from "@/lib/fetchWithQuotaToast";

export type ChatCitation = {
  tag?: string;
  document_id?: string;
  page_start?: number | null;
  page_end?: number | null;
  title?: string; // future-friendly
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  citations?: ChatCitation[];
};

type SendParams = {
  text: string;
  botId: string;
  topK?: number;
  model?: string;
};

function uid(prefix: "u" | "a") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChatClient(initialConversationId?: string) {
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const mounted = useRef(false);

  // Restore last conversation from localStorage (once)
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    try {
      const cached = localStorage.getItem("faqbot:lastChat");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          setConversationId(parsed.conversationId ?? undefined);
          if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(
        "faqbot:lastChat",
        JSON.stringify({ conversationId, messages })
      );
    } catch {
      // ignore
    }
  }, [conversationId, messages]);

  async function send({ text, botId, topK = 6, model }: SendParams) {
    const q = text.trim();
    if (!q) return;

    // Optimistic user message
    const userMsg: ChatMessage = {
      id: uid("u"),
      role: "user",
      content: q,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    setSending(true);
    try {
      const res = await fetchWithQuotaToast("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bot_id: botId, // private mode dev/testing; public mode uses bot_public_token
          messages: [{ role: "user", content: q }],
          top_k: topK,
          ...(model ? { model } : {}),
          conversation_id: conversationId ?? null, // harmless if backend ignores
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text();
      const json = contentType.includes("application/json")
        ? (JSON.parse(raw) as any)
        : { ok: false, error: raw };

      if (!res.ok || !json?.ok) {
        const errText = json?.error || `HTTP ${res.status}`;
        setMessages((m) => [
          ...m,
          {
            id: uid("a"),
            role: "assistant",
            content: `⚠ ${errText}`,
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }

      // Normalize sources → citations
      const citations: ChatCitation[] = Array.isArray(json.sources)
        ? json.sources.map((s: any) => ({
            tag: s?.tag,
            document_id: s?.document_id,
            page_start: s?.page_start ?? null,
            page_end: s?.page_end ?? null,
          }))
        : [];

      const assistant: ChatMessage = {
        id: uid("a"),
        role: "assistant",
        content: String(json.answer || ""),
        created_at: new Date().toISOString(),
        citations,
      };
      setMessages((m) => [...m, assistant]);

      // Adopt conversation_id if backend returns one
      if (json.conversation_id && !conversationId) {
        setConversationId(json.conversation_id);
      }
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          id: uid("a"),
          role: "assistant",
          content: `⚠ ${e?.message || "Chat failed"}`,
          created_at: new Date().toISOString(),
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


