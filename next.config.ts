// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdf-parse external so Next doesn't bundle it (prevents ESM/CJS weirdness)
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;










