import { NextRequest } from "next/server";
import { supaAdmin } from "@/lib/supaAdmin";

export async function POST(req: NextRequest) {
  const { orgName, slug, botName } = await req.json();
  if (!orgName || !slug || !botName) {
    return Response.json({ error: "Missing orgName/slug/botName" }, { status: 400 });
  }

  const { data: org, error: e1 } = await supaAdmin
    .from("organizations")
    .insert({ name: orgName, slug })
    .select()
    .single();
  if (e1) return Response.json({ error: e1.message }, { status: 500 });

  const { data: bot, error: e2 } = await supaAdmin
    .from("bots")
    .insert({ org_id: org.id, name: botName })
    .select()
    .single();
  if (e2) return Response.json({ error: e2.message }, { status: 500 });

  return Response.json({ ok: true, org, bot });
}
