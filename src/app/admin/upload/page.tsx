// src/app/admin/upload/page.tsx
import { redirect } from "next/navigation";
import { supaServer } from "@/lib/supaServer";
import UploadForm from "./UploadForm";

export default async function AdminUploadPage() {
  // Server-side: ensure you’re logged in, otherwise redirect to /login
  const supa = await supaServer();
  const { data: { user } } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // (Optional) Restrict to admins only:
  // const { data: profile } = await supa
  //   .from("profiles")
  //   .select("role")
  //   .eq("user_id", user.id)
  //   .single();
  // if (profile?.role !== "admin") redirect("/");

  return <UploadForm />;
}

