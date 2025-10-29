export function chunkText(text: string, max = 800) {
  const parts = text.replace(/\s+/g, " ").split(/(?<=[\.\?\!])\s+/);
  const chunks: string[] = [];
  let buf = "";

  for (const s of parts) {
    if (!s) continue;
    if ((buf + " " + s).trim().length > max) {
      if (buf.trim()) chunks.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? buf + " " + s : s;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}
