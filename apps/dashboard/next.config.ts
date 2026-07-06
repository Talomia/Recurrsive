import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  /** Disable the X-Powered-By header for security. */
  poweredByHeader: false,

  turbopack: {
    root: path.join(__dirname, "../.."),
  },

  /** Tree-shake large icon libraries for smaller bundles. */
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  /** Security and caching headers. */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  /**
   * API proxy is handled by the catch-all route at
   * /api/v1/[...path]/route.ts which reads INTERNAL_API_URL at runtime.
   * This replaces the previous rewrites() approach which baked the
   * destination URL at build time (incompatible with Docker standalone).
   */
};

export default nextConfig;
