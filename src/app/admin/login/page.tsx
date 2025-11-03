"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function AdminLogin() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const next = useSearchParams().get("next") || "/admin";
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok || !json.ok) return alert(json.error || "Login failed");
    router.push(next);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Admin Login</h1>
        <input
          className="w-full rounded-lg border p-2"
          placeholder="Admin token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button
          className="w-full rounded-xl px-4 py-2 bg-blue-600 text-white disabled:opacity-60"
          disabled={loading || !token}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
