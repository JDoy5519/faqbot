// src/app/admin/upload/UploadForm.tsx
"use client";
import { useState } from "react";

export default function UploadForm() {
  const [botId, setBotId] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string>();

  async function submit() {
    setStatus("Uploading...");
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ botId, text })
    });
    const json = await res.json();
    setStatus(json.ok ? `Inserted ${json.inserted} chunks` : `Error: ${json.error}`);
  }

  return (
    <main style={{maxWidth: 720, margin: "40px auto", fontFamily: "system-ui"}}>
      <h1>Upload FAQ Chunks</h1>
      <input
        placeholder="Bot ID"
        value={botId}
        onChange={(e) => setBotId(e.target.value)}
        style={{width: "100%", padding: 10, marginBottom: 8}}
      />
      <textarea
        placeholder="Paste FAQ text here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        style={{width: "100%", padding: 10}}
      />
      <button onClick={submit} style={{marginTop: 12, padding: "10px 16px"}}>Upload</button>
      {status && <p style={{marginTop: 12}}>{status}</p>}
    </main>
  );
}
