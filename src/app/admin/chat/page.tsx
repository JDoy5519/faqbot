"use client";

import { useEffect, useState } from "react";
import { useChatClient } from "@/lib/useChatClient";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { ChatComposer } from "@/components/ui/ChatComposer";

type Bot = { id: string; name: string };

export default function AdminChatPage() {
  const [botId, setBotId] = useState("");
  const [bots, setBots] = useState<Bot[]>([]);
  const { messages, sending, send, resetConversation } = useChatClient();

  // Optional: load bots for a nicer selector
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/bots/lookup", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const list: Bot[] = j?.bots ?? j ?? [];
        setBots(list);
        if (!botId && list.length) setBotId(list[0].id);
      } catch {}
    })();
  }, [botId]);

  function onSend(text: string) {
    if (!botId) {
      alert("Enter/select a Bot ID first.");
      return;
    }
    send({ text, botId, topK: 6 });
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Chat</h1>
          <p className="text-xs text-gray-500">Powered by your existing /api/chat route.</p>
        </div>
        <button className="rounded-md border px-3 py-1.5 text-sm" onClick={resetConversation} disabled={sending}>
          New chat
        </button>
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <label className="block text-sm">
          <span className="mb-1 block">Bot</span>
          {bots.length ? (
            <select
              className="w-full rounded border px-2 py-1"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
            >
              {bots.map((b) => (
                <option key={b.id} value={b.id}>{b.name} — {b.id}</option>
              ))}
            </select>
          ) : (
            <input
              className="w-full rounded border px-2 py-1"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          )}
        </label>
      </div>

      <div className="min-h-[50vh] rounded-md border p-3">
        {messages.length === 0 ? (
          <div className="flex h-[40vh] items-center justify-center text-sm text-gray-500">
            Ask anything about your uploaded PDFs.
          </div>
        ) : (
          messages.map((m) => <ChatBubble key={m.id} m={m} />)
        )}
      </div>

      <div className="mt-2">
        <ChatComposer onSend={onSend} disabled={sending} />
        <p className="mt-2 text-xs text-gray-500">
          You’ll see a toast if you’re near your plan limit.
        </p>
      </div>
    </div>
  );
}
