import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal self-contained server bundle: enables slim Docker images
  // (traced node_modules instead of the full production install).
  output: "standalone",
  // Photos are served raw via our own route; next/image is never used.
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
};

export default nextConfig;