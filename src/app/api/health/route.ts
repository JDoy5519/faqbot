export async function GET() {
  return new Response(JSON.stringify({
    ok: true,
    time: new Date().toISOString(),
    service: "faqbot"
  }), { headers: { "Content-Type": "application/json" }});
}
