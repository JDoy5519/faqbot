export function buildPrompt(contextChunks: string[], question: string) {
  const context = contextChunks
    .map((c, i) => `[[Chunk ${i + 1}]]\n${c}`)
    .join("\n\n");

  const instructions = `
You are a precise, friendly FAQ assistant for a UK business.
Only answer using the CONTEXT below. If the answer is not clearly present, say:
"I’m not sure from our current FAQ. Would you like me to pass this to a human?"
Be concise, UK English, no speculation, no hallucinations.
If there are multiple relevant points, use short bullet points.
`.trim();

  return `INSTRUCTIONS:
${instructions}

CONTEXT:
${context}

QUESTION:
${question}

FINAL ANSWER (UK English, concise):`;
}
