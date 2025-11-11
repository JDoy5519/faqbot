"use client";
import { useState } from "react";

export function ChatComposer({
  onSend, disabled, placeholder = "Ask a question about your docs…",
}: { onSend: (text: string) => void; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        className="flex-1 rounded-md border px-3 py-2 text-sm"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />
      <button className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" disabled={disabled || !text.trim()}>
        {disabled ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

