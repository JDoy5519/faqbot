"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const PAGE_SIZE_DEFAULT = 20;

export default function ConversationsListClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const q = (sp.get("q") || "").trim();
  const helpful = sp.get("helpful") || "";
  const page = Math.max(Number(sp.get("page") || "1"), 1);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const totalPages = useMemo(() => Math.max(Math.ceil((total || 0) / (pageSize || PAGE_SIZE_DEFAULT)), 1), [total, pageSize]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (helpful) params.set("helpful", helpful);
    if (page > 1) params.set("page", String(page));

    fetch(`/api/admin/conversations?${params.toString()}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          router.push("/login");
          return;
        }
        const data = await r.json();
        setRows(data.conversations || []);
        setTotal(data.total || 0);
        setPageSize(data.pageSize || PAGE_SIZE_DEFAULT);
      })
      .finally(() => setLoading(false));
  }, [q, helpful, page, router]);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 16 }}>Recent conversations</h1>

      {/* Filters */}
      <form method="get" style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <input type="text" name="q" defaultValue={q} placeholder="Search message text…" style={{ flex: 1, padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8 }} />
        <select name="helpful" defaultValue={helpful} style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8 }}>
          <option value="">All</option>
          <option value="helpful">Only helpful</option>
          <option value="unhelpful">Only unhelpful</option>
        </select>
        <button type="submit" style={{ padding: "8px 12px", border: "1px solid #0d6efd", background: "#0d6efd", color: "#fff", borderRadius: 8, fontWeight: 600 }}>Apply</button>
      </form>

      {/* Results */}
      {loading ? (
        <div style={{ color: "#666" }}>Loading…</div>
      ) : rows.length ? (
        <section style={{ display: "grid", gap: 8 }}>
          {rows.map((c: any) => (
            <Link key={c.id} href={`/admin/conversations/${c.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", border: "1px solid #eee", borderRadius: 10, textDecoration: "none", color: "inherit", background: "#fff" }}>
              <div>
                <strong>#{c.id.slice(0, 8)}</strong>
                <div style={{ color: "#666", fontSize: 13 }}>{c.created_at ? new Date(c.created_at).toLocaleString() : "—"}</div>
              </div>
              <div style={{ color: "#666", fontSize: 12 }}>bot: {c.bot_id?.slice?.(0, 8) || "-"}</div>
            </Link>
          ))}
        </section>
      ) : (
        <div style={{ color: "#666", padding: 24, border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
          No conversations found.
        </div>
      )}

      {/* Pagination */}
      <nav style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {page > 1 && (
          <a href={`?${new URLSearchParams({ q, helpful, page: String(page - 1) })}`} style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
            ← Prev
          </a>
        )}
        <span style={{ padding: "8px 12px", color: "#666" }}>
          Page {page} / {totalPages}
        </span>
        {page < totalPages && (
          <a href={`?${new URLSearchParams({ q, helpful, page: String(page + 1) })}`} style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
            Next →
          </a>
        )}
      </nav>
    </main>
  );
}

