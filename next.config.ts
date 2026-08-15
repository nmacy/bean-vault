import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal self-contained server bundle: enables slim Docker images
  // (traced node_modules instead of the full production install).
  output: "standalone",
  // Photos are served raw via our own route; next/image is never used.
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
  // Bean Vault backup imports embed photos as base64; the default 1 MB
  // Server Action body cap rejects them.
  experimental: {
    serverActions: {
      bodySizeLimit: "300mb",
    },
  },
};

export default nextConfig;