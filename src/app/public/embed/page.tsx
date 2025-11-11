// src/app/public/embed/page.tsx
export const dynamic = "force-dynamic";

import PublicEmbedClient from "./PublicEmbedClient";

export default function EmbedPage({
  searchParams,
}: {
  searchParams: { token?: string; theme?: string; color?: string; corner?: "left" | "right"; top_k?: string };
}) {
  const token = searchParams?.token || "";
  const theme = (searchParams?.theme || "light") as "light" | "dark";
  const color = searchParams?.color || "#3B82F6";
  const corner = (searchParams?.corner || "right") as "left" | "right";
  const topK = Number(searchParams?.top_k ?? "6");

  if (!token) {
    return <div style={{ padding: 16, fontSize: 12, fontFamily: "system-ui" }}>Missing token</div>;
  }

  return (
    <PublicEmbedClient
      token={token}
      theme={theme}
      color={color}
      corner={corner}
      topK={Number.isFinite(topK) ? topK : 6}
    />
  );
}


