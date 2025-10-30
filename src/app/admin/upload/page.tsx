// src/app/admin/upload/page.tsx
import { redirect } from "next/navigation";
import { supaServer } from "@/lib/supaServer";
import UploadForm from "./UploadForm";

export default async function AdminUploadPage() {
  // Server-side: ensure user is logged in
  const supa = await supaServer();
  const { data: { user } } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // (Optional) Restrict to admins only
  // const { data: profile } = await supa
  //   .from("profiles")
  //   .select("role")
  //   .eq("user_id", user.id)
  //   .single();
  // if (profile?.role !== "admin") redirect("/");

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Upload Knowledge Base</h1>
        <a
          href="/admin/import"
          style={{
            marginLeft: 12,
            textDecoration: "none",
            padding: "6px 12px",
            border: "1px solid #0d6efd",
            borderRadius: 6,
            color: "#0d6efd",
            fontSize: 14,
          }}
        >
          Import from URL/PDF
        </a>
      </div>

      <div style={{ marginTop: 24 }}>
        <UploadForm />
      </div>
    </main>
  );
}


