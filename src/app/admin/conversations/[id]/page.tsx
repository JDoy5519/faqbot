"use client";

import { useEffect, useState } from "react";

import { useParams } from "next/navigation";



export default function ConversationDetail() {

  const params = useParams<{ id: string }>();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;



  const [data, setData] = useState<any>(null);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    if (!id) return;

    fetch(`/api/admin/conversations/${id}`, { cache: "no-store" })

      .then((r) => r.json())

      .then(setData)

      .finally(() => setLoading(false));

  }, [id]);



  if (!id) return <main style={{maxWidth:900, margin:"40px auto"}}>Invalid id.</main>;

  if (loading) return <main style={{maxWidth:900, margin:"40px auto"}}>Loading…</main>;

  if (!data?.ok) return <main style={{maxWidth:900, margin:"40px auto"}}><h1>Conversation not found</h1></main>;



  const { conversation, messages } = data;



  return (

    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>

      <header style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>

        <div>

          <h1 style={{ margin: 0 }}>Conversation #{conversation.id.slice(0, 8)}</h1>

          <div style={{ color: "#666" }}>{new Date(conversation.created_at).toLocaleString()}</div>

        </div>

        <a href={`/api/admin/conversations/${conversation.id}/export`} style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>

          Export JSON

        </a>

      </header>



      <section style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>

        {messages.length === 0 && <div style={{ padding: 24, color: "#666" }}>No messages yet.</div>}

        {messages.map((m: any) => (

          <article key={m.id} style={{ padding: "16px 20px", borderTop: "1px solid #f2f2f2", background: m.role === "assistant" ? "#fbfdff" : "white" }}>

            <div style={{ display: "flex", justifyContent: "space-between" }}>

              <strong>{m.role}</strong>

              <small style={{ color: "#666" }}>{new Date(m.created_at).toLocaleString()}</small>

            </div>

            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 6 }}>{m.content}</div>

            <FeedbackRow mid={m.id} helpful={m.helpful} note={m.feedback_note} />

          </article>

        ))}

      </section>

    </main>

  );

}



function FeedbackRow({ mid, helpful, note }: { mid: string; helpful: boolean | null; note: string | null }) {

  return (

    <form action={`/api/admin/messages/${mid}/feedback`} method="post" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>

      <input type="hidden" name="mid" value={mid} />

      <button name="helpful" value="true" style={btn(helpful === true)}>👍 Helpful</button>

      <button name="helpful" value="false" style={btn(helpful === false)}>👎 Not helpful</button>

      <input name="note" defaultValue={note ?? ""} placeholder="Add a note…" style={{ flex: 1, padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6 }} />

      <button type="submit" style={smallPrimary}>Save</button>

    </form>

  );

}



const smallPrimary: React.CSSProperties = {

  padding: "6px 10px",

  borderRadius: 6,

  border: "1px solid #0d6efd",

  background: "#0d6efd",

  color: "#fff",

  fontWeight: 600,

};



function btn(active: boolean) {

  return {

    padding: "6px 10px",

    borderRadius: 6,

    border: active ? "1px solid #0d6efd" : "1px solid #ddd",

    background: active ? "#eaf2ff" : "white",

    cursor: "pointer",

  } as React.CSSProperties;

}
