export const runtime = "nodejs"; // service role key must NOT run at the edge

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { supaAdmin } from "@/lib/supaAdmin";
import { retrieveTopK } from "@/lib/retrieve";
import { buildPrompt } from "@/lib/prompt";

const USE_FAKE_ANSWERS = process.env.USE_FAKE_ANSWERS === "1";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple confidence mapping
function confidenceFromSimilarity(sim: number) {
  if (sim >= 0.85) return { score: sim, label: "high" as const };
  if (sim >= 0.70) return { score: sim, label: "medium" as const };
  return { score: sim, label: "low" as const };
}

export async function POST(req: NextRequest) {
  try {
    const { botId, question, conversationId } = await req.json();

    if (!botId || !question) {
      return Response.json({ error: "Missing botId/question" }, { status: 400 });
    }

    // 👇 Guard: ensure the bot exists before any work
    const { data: bot, error: botErr } = await supaAdmin
      .from("bots")
      .select("id")
      .eq("id", botId)
      .single();

    if (botErr || !bot) {
      return Response.json({ error: "Invalid botId" }, { status: 400 });
    }

    // 1) Retrieve chunks
    const matches = await retrieveTopK(botId, question, 6);
    const topSim = matches[0]?.similarity ?? 0;
    const conf = confidenceFromSimilarity(topSim);

    // 2) Build prompt
    const prompt = buildPrompt(matches.map((m) => m.content), question);

    // 3) Call the model (or fake)
    let answer = "";
    try {
      if (USE_FAKE_ANSWERS) {
        const preview = matches.map((m) => `• ${m.content}`).join("\n");
        answer =
          matches.length > 0
            ? `Based on our documents:\n\n${preview}`
            : `I'm not sure from our current FAQ. Would you like me to pass this to a human?`;
      } else {
        const res = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You answer ONLY from provided context." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        });
        answer = res.choices[0]?.message?.content?.trim() || "";
      }
    } catch {
      answer = "Sorry — our answer engine is unavailable right now. Please try again shortly.";
    }

    // 4) Ensure conversation
    let convId = conversationId as string | undefined;
    if (!convId) {
      const { data: conv, error: eConv } = await supaAdmin
        .from("conversations")
        .insert({ bot_id: botId })
        .select()
        .single();
      if (eConv || !conv) throw new Error(eConv?.message || "conversation create failed");
      convId = conv.id;
    }

    // 5) Log user message
    await supaAdmin.from("messages").insert({
      conversation_id: convId,
      role: "user",
      content: question,
      confidence: null,
    });

    // 6) Log assistant reply
    await supaAdmin.from("messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: answer,
      confidence: conf.score,
    });

    // 7) Optional usage metric
    await supaAdmin.from("usage_events").insert({
      org_id: null,
      bot_id: botId,
      kind: "message",
      qty: 1,
    });

    return Response.json({
      ok: true,
      conversationId: convId,
      answer,
      confidence: conf,
      usedChunks: matches.map((m) => ({ id: m.id, similarity: m.similarity })),
    });
  } catch (err: any) {
    console.error("chat error", err?.message || err);
    return Response.json({ error: err?.message || "chat failed" }, { status: 500 });
  }
}

