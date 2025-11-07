// src/lib/rag.ts
export type Match = {
  content: string;
  document_id: string;
  source_page_start: number | null;
  source_page_end: number | null;
  score: number;
  document_title?: string | null;
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

// --- Add these helpers below your existing exports ---

/**
 * Build the final messages array for a chat completion call.
 * Usage in /api/chat: const msgs = buildMessages(question, matches)
 */
export function buildMessages(
  question: string,
  matches: Match[],
  system = buildSystemPrompt()
) {
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: buildUserPrompt(question, matches) },
  ];
}

/**
 * Parse "Sources: [S1, S3, S4]" from the model answer and return zero-based indexes [0,2,3].
 * If no sources are found, returns [].
 */
export function parseUsedSourceIndexes(answer: string): number[] {
  const m = answer.match(/Sources:\s*\[([^\]]*)\]/i);
  if (!m) return [];
  const inside = m[1];
  const tags = inside.split(",").map(s => s.trim());
  const ids = tags
    .map(t => t.match(/^S(\d+)$/i)?.[1])
    .filter(Boolean)
    .map(n => parseInt(n!, 10) - 1)
    .filter(i => Number.isFinite(i) && i >= 0);
  // Dedup and sort
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

/**
 * Render a readable citation block from indexes and matches.
 * Example:
 *  Sources:
 *  1) Doc 123 — Title (pages 2–3)
 */
export function renderSourcesDetail(matches: Match[], usedIndexes: number[]) {
  if (!usedIndexes.length) return "";
  const lines = usedIndexes.map(idx => {
    const m = matches[idx];
    if (!m) return null;
    const pages =
      m.source_page_start == null && m.source_page_end == null
        ? ""
        : ` (pages ${m.source_page_start ?? "?"}–${m.source_page_end ?? "?"})`;
    const title = m.document_title ? ` — ${m.document_title}` : "";
    return `${idx + 1}) Doc ${m.document_id}${title}${pages}`;
  }).filter(Boolean) as string[];

  return ["", "Sources:", ...lines].join("\n");
}

/**
 * Strip the compact "Sources: [...]" line from the raw model text.
 */
export function stripCompactSourcesLine(answer: string) {
  return answer.replace(/\n?Sources:\s*\[[^\]]*\]\s*$/i, "").trim();
}

/**
 * Convenience: choose top-k matches safely.
 */
export function topK(matches: Match[], k = 6): Match[] {
  return (matches || []).slice(0, Math.max(0, k));
}

