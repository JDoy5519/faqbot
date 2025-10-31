import { createHash } from "crypto";
import { encode } from "gpt-tokenizer";

/** Normalize whitespace for stable hashing & packing */
export function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Simple tokenizer using cl100k_base (GPT-4/3.5 style). */
function tokenCount(text: string): number {
  // cl100k_base-compatible encode returns token ids; length is the count
  return encode(text).length;
}

export type PageBlock = { page: number; text: string }; // 1-based page number

export type Chunk = {
  content: string;
  token_count: number;
  source_page_start: number | null;
  source_page_end: number | null;
  hash: string;
};

/**
 * Greedy packer: builds chunks between minTokens and maxTokens, respecting page/paragraph
 * boundaries where possible. Last chunk can be smaller.
 */
export function buildChunksFromPages(
  pages: PageBlock[],
  opts: { minTokens?: number; maxTokens?: number } = {}
): Chunk[] {
  const minTokens = opts.minTokens ?? 800;
  const maxTokens = opts.maxTokens ?? 1200;

  // Split each page into paragraphs (double newline or long single newline groups)
  const paraBlocks: Array<{ text: string; page: number }> = [];
  for (const p of pages) {
    const paras = p.text
      .replace(/\r/g, "")
      .split(/\n{2,}|\u000c/g) // double newlines or form-feed just in case
      .map(t => normalizeText(t))
      .filter(Boolean);

    for (const t of paras) paraBlocks.push({ text: t, page: p.page });
  }

  const chunks: Chunk[] = [];
  let cur: string[] = [];
  let curPages: number[] = [];

  const flush = () => {
    if (cur.length === 0) return;
    const content = normalizeText(cur.join("\n\n"));
    const tokens = tokenCount(content);
    const start = curPages.length ? Math.min(...curPages) : null;
    const end = curPages.length ? Math.max(...curPages) : null;
    const hash = createHash("sha1").update(content.toLowerCase(), "utf8").digest("hex");
    chunks.push({
      content,
      token_count: tokens,
      source_page_start: start,
      source_page_end: end,
      hash,
    });
    cur = [];
    curPages = [];
  };

  for (const b of paraBlocks) {
    const candidate = normalizeText((cur.join("\n\n") + (cur.length ? "\n\n" : "") + b.text) || b.text);
    const candTokens = tokenCount(candidate);

    if (candTokens <= maxTokens) {
      cur.push(b.text);
      curPages.push(b.page);
      continue;
    }

    // If current is empty and single paragraph is too big, hard-split this paragraph
    if (cur.length === 0) {
      // naive split by sentences to get under maxTokens
      const sentences = b.text.split(/(?<=[.!?])\s+/g);
      let buf: string[] = [];
      for (const s of sentences) {
        const candidate2 = normalizeText((buf.join(" ") + (buf.length ? " " : "") + s) || s);
        if (tokenCount(candidate2) > maxTokens) {
          if (buf.length) {
            cur = [normalizeText(buf.join(" "))];
            curPages = [b.page];
            flush();
            buf = [s];
          } else {
            // single sentence still too big — last resort: slice by words
            const words = s.split(/\s+/);
            let wbuf: string[] = [];
            for (const w of words) {
              const cand3 = normalizeText((wbuf.join(" ") + (wbuf.length ? " " : "") + w) || w);
              if (tokenCount(cand3) > maxTokens) {
                if (wbuf.length) {
                  cur = [normalizeText(wbuf.join(" "))];
                  curPages = [b.page];
                  flush();
                  wbuf = [w];
                } else {
                  // word bigger than maxTokens (unlikely) — accept as a tiny chunk
                  cur = [w];
                  curPages = [b.page];
                  flush();
                }
              } else {
                wbuf.push(w);
              }
            }
            if (wbuf.length) {
              cur = [normalizeText(wbuf.join(" "))];
              curPages = [b.page];
              flush();
            }
            buf = [];
          }
        } else {
          buf.push(s);
        }
      }
      if (buf.length) {
        cur = [normalizeText(buf.join(" "))];
        curPages = [b.page];
      }
      // continue to next paragraph
      continue;
    }

    // current has content but adding this para would exceed max
    // if the current is still too small (< min), we still flush to avoid overflow
    flush();
    // start new chunk with this paragraph (it may get more in next iterations)
    cur = [b.text];
    curPages = [b.page];
  }

  if (cur.length) flush();

  // Optionally, merge tiny last chunk into previous if combined <= maxTokens
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (last.token_count < Math.min(200, Math.floor((minTokens * 2) / 3))) {
      const combined = normalizeText(prev.content + "\n\n" + last.content);
      if (tokenCount(combined) <= maxTokens) {
        const merged: Chunk = {
          content: combined,
          token_count: tokenCount(combined),
          source_page_start: prev.source_page_start ?? last.source_page_start,
          source_page_end: last.source_page_end ?? prev.source_page_end,
          hash: createHash("sha1").update(combined.toLowerCase(), "utf8").digest("hex"),
        };
        chunks.splice(chunks.length - 2, 2, merged);
      }
    }
  }

  return chunks;
}
