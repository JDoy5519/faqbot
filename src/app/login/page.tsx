"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supaBrowser } from "@/lib/supaBrowser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Signing in...");
    const { error } = await supaBrowser.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }
    setStatus("Signed in. Redirecting…");
    router.push("/admin/upload");
  }

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", fontFamily: "system-ui" }}>
      <h1>Admin Login</h1>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 8 }}
          required
        />
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 8 }}
          required
        />
        <button type="submit" style={{ padding: "10px 16px" }}>Sign in</button>
      </form>
      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </main>
  );
}
