// src/app/api/admin/jobs/[id]/route.ts
import { NextResponse } from "next/server";
import { supaServer } from "@/lib/supaServer";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await supaServer();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, state, progress_percent, error_message, document_id, type, created_at, updated_at")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
