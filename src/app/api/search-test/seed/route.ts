import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supaAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/\W+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orgName, slug, botName } = body ?? {};
  if (!orgName || !slug || !botName) {
    return Response.json({ error: "Missing orgName/slug/botName" }, { status: 400 });
  }

  // 1) Create org
  const { data: org, error: e1 } = await supabaseAdmin
    .from("organizations")
    .insert({ name: orgName, slug: slugify(slug) })
    .select()
    .single();

  if (e1) {
    // Unique violation → 409 conflict
    if ((e1 as any).code === "23505") {
      return Response.json({ error: "Slug already exists" }, { status: 409 });
    }
    return Response.json({ error: e1.message }, { status: 500 });
  }

  // 2) Create bot
  const { data: bot, error: e2 } = await supabaseAdmin
    .from("bots")
    .insert({ org_id: org.id, name: botName, slug: slugify(botName) })
    .select()
    .single();

  if (e2) return Response.json({ error: e2.message }, { status: 500 });

  return Response.json({ ok: true, org, bot }, { status: 201 });
}

