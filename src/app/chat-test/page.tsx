"use client";
import { useState } from "react";

export default function ChatTest() {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [convId, setConvId] = useState<string>();

  async function ask() {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botId: "9b46842f-1658-481c-902f-9f2e37ae897b",
        question: q,
        conversationId: convId
      })
    });
    const json = await res.json();
    if (json.ok) {
      setAns(json.answer);
      setConvId(json.conversationId);
    } else {
      setAns(`Error: ${json.error || "unknown"}`);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Chat Test</h1>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Ask a question..."
        style={{ width: "100%", padding: 12, fontSize: 16 }}
      />
      <button onClick={ask} style={{ marginTop: 12, padding: "10px 16px" }}>
        Ask
      </button>
      {ans && (
        <div style={{ marginTop: 20, padding: 12, background: "#f7f7f7", borderRadius: 8 }}>
          <strong>Answer:</strong>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{ans}</div>
          {convId && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>conversationId: {convId}</div>}
        </div>
      )}
    </main>
  );
}
