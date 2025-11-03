// src/lib/ai.ts
import OpenAI from "openai";

const useFakeEmbeddings = process.env.USE_FAKE_EMBEDDINGS === "1";
// Fake chat is ON by default unless you set USE_FAKE_CHAT=0 and provide an OPENAI_API_KEY
const useFakeChat = process.env.USE_FAKE_CHAT !== "0" || !process.env.OPENAI_API_KEY;

// NOTE: don't construct the client unless we actually need real calls
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ---------------- Embeddings (your existing logic kept) ----------------

// Cheap deterministic number from text (good enough for a demo)
function cheapHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// Make a 1536-d vector from repeated hash-based noise
function fakeEmbedOne(text: string) {
  const dim = 1536;
  const v = new Array<number>(dim);
  let seed = cheapHash(text) || 1;
  for (let i = 0; i < dim; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    v[i] = (seed % 1000) / 500 - 1; // [-1,1]
  }
  return v;
}

export async function embedTexts(texts: string[]) {
  if (!texts.length) return [];
  if (useFakeEmbeddings) return texts.map(fakeEmbedOne);

  try {
    const openai = getOpenAI();
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    return res.data.map((d) => d.embedding);
  } catch (err: any) {
    console.error("Embedding error:", err?.status, err?.code || err?.message);
    throw err;
  }
}

// ---------------- Chat wrapper (new) ----------------
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chat(params: {
  model: string;
  temperature?: number;
  messages: ChatMessage[];
}) {
  if (useFakeChat) {
    const userContent = [...params.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const sources = userContent.match(/Sources:\s*\[[^\]]*\]/i)?.[0] ?? "Sources: [S1]";
    const content =
      "Here’s a concise answer generated in fake mode for development.\n\n" + sources;
    return { choices: [{ message: { content } }] } as const;
  }

  const openai = getOpenAI(); // only now we require the key
  return openai.chat.completions.create({
    model: params.model,
    temperature: params.temperature ?? 0.2,
    messages: params.messages,
  });
}

// (optional constant you already had)
export const FAQ_SYSTEM_PROMPT = `
You are a precise, friendly FAQ assistant for a UK business.
Only answer using the provided company context.
If an answer isn't clearly present, say you don't know and offer escalation to a human.
Use concise UK English; avoid speculation.
`;
