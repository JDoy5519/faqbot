import { supabaseAdmin } from "@/lib/supaAdmin";
import { embedTexts } from "@/lib/ai";

export type RetrievedChunk = { id: string; content: string; similarity: number };

export async function retrieveTopK(botId: string, question: string, k = 6) {
  const [qvec] = await embedTexts([question]);       // 1536-d vector
  const { data, error } = await supabaseAdmin.rpc("match_doc_chunks", {
    p_bot_id: botId,
    p_query_embedding: qvec,
    p_match_count: k
  });
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    id: r.id,
    content: r.content,
    similarity: Number(r.similarity ?? 0)
  })) as RetrievedChunk[];
}
