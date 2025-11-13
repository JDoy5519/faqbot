// src/app/admin/page.tsx
import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  // Always send people to the onboarding/checklist by default
  redirect("/admin/get-started");
}
