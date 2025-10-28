import { pingAI } from "@/lib/ai";

export async function GET() {
  return new Response(JSON.stringify({ ok: await pingAI() }), {
    headers: { "Content-Type": "application/json" }
  });
}
