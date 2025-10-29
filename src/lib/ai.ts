// src/lib/ai.ts
import OpenAI from "openai";

const useFake = process.env.USE_FAKE_EMBEDDINGS === "1";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Cheap deterministic number from text (good enough for a demo)
function cheapHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

// Make a 1536-d vector from repeated hash-based noise
function fakeEmbedOne(text: string) {
  const dim = 1536;
  const v = new Array<number>(dim);
  let seed = cheapHash(text) || 1;
  for (let i = 0; i < dim; i++) {
    // xorshift-ish
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    // map to [-1, 1]
    v[i] = (seed % 1000) / 500 - 1;
  }
  return v;
}

export async function embedTexts(texts: string[]) {
  if (!texts.length) return [];
  if (useFake) {
    return texts.map(fakeEmbedOne);
  }

  // Real call (1536-dim model)
  try {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts
    });
    return res.data.map(d => d.embedding);
  } catch (err: any) {
    // Helpful errors in dev
    console.error("Embedding error:", err?.status, err?.code || err?.message);
    throw err;
  }
}

export const FAQ_SYSTEM_PROMPT = `
You are a precise, friendly FAQ assistant for a UK business.
Only answer using the provided company context.
If an answer isn't clearly present, say you don't know and offer escalation to a human.
Use concise UK English; avoid speculation.
`;


