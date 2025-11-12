// Fail fast if a required env var is missing (works server + client)
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`❌ Missing required environment variable: ${name}`);
  }
  return v;
}

