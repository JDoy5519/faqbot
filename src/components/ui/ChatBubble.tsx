"use client";
import type { ChatMessage } from "@/lib/useChatClient";

export function ChatBubble({ m }: { m: ChatMessage }) {
  const isUser = m.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} my-2`}>
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
        isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
      }`}>
        <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
        {!isUser && m.citations?.length ? (
          <div className={`mt-2 text-xs ${isUser ? "text-blue-100" : "text-gray-600"}`}>
            <strong>Citations:</strong>{" "}
            {m.citations.map((c, i) => (
              <span key={i} className="mr-2">
                {c.tag || c.document_id || "source"}
                {c.page_start != null ? ` p.${c.page_start}` : ""}
                {c.page_end && c.page_end !== c.page_start ? `–${c.page_end}` : ""}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

