import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // On Vercel without Redis, the server seeds a /tmp SQLite copy from these files (if present).
  outputFileTracingIncludes: {
    "/**": ["./data/kensho.db*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
