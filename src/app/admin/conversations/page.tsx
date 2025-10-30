import { redirect } from "next/navigation";
import { supaServer } from "@/lib/supaServer";

export default async function ConversationsPage() {
  const supa = await supaServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect("/login");

  const { data: convs } = await supa
    .from("conversations")
    .select("id, created_at, bot_id")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Recent Conversations</h1>
      <ul>
        {convs?.map(c => (
          <li key={c.id}>
            <strong>{c.id}</strong> – {new Date(c.created_at).toLocaleString()}
          </li>
        ))}
      </ul>
    </main>
  );
}
