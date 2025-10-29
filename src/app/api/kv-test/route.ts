import { kvConnect } from "@/lib/kv";

export async function GET() {
  const kv = await kvConnect();

  const key = "test-counter";
  const count = await kv.incr(key);

  // expire after 60 seconds so it resets
  await kv.expire(key, 60);

  return Response.json({ ok: true, count });
}
