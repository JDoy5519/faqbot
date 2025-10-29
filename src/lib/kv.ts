import { createClient } from "redis";

const client = createClient({
  url: process.env.REDIS_URL!,
});

client.on("error", (err: unknown) => console.error("Redis Client Error", err));

let connected = false;

export async function kvConnect() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client;
}
