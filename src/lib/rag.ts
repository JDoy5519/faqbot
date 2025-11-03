// src/lib/rag.ts
export type Match = {
  content: string;
  document_id: string;
  source_page_start: number | null;
  source_page_end: number | null;
  score: number;
};

export function buildSystemPrompt() {
  return [
    "You are a precise, friendly FAQ assistant for a UK business.",
    "Only answer using the provided context snippets.",
    "If the answer isn't clearly present, say you don't know and offer escalation to a human.",
    "Use concise UK English; avoid speculation.",
  ].join(" ");
}

export function buildUserPrompt(question: string, matches: Match[]) {
  const context = matches
    .map((m, i) => {
      // When building `pages`, ensure backticks:
const pages =
m.source_page_start == null && m.source_page_end == null
  ? ""
  : ` (pages ${m.source_page_start ?? "?"}–${m.source_page_end ?? "?"})`;

// When returning the block:
return `# Source ${i + 1}${pages}\n${m.content}`;
    })
    .join("\n\n");

  return [
    "Context snippets:",
    context || "(none)",
    "",
    "Question:",
    question,
    "",
    "Instructions:",
    "- If multiple sources overlap, synthesise but do not invent.",
    "- If unsure, say you don't know.",
    "- Provide a short, direct answer (3–6 sentences max).",
    "- Add a compact Sources: [S1, S3...] line referencing the source numbers used.",
  ].join("\n");
}

export function compactCitations(matches: Match[], usedIndexes: number[]) {
  // Turn [0,2,3] => ["S1","S3","S4"]
  const tags = usedIndexes.map((i) => `S${i + 1}`);
return `Sources: [${tags.join(", ")}]`;
}
