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
   * Proxy API calls to the Recurrsive server.
   *
   * Uses INTERNAL_API_URL (runtime) or NEXT_PUBLIC_API_URL (build-time)
   * to determine the upstream server. In EasyPanel/Docker, this is the
   * internal service hostname (e.g. http://recurrsive_server:3000).
   */
  async rewrites() {
    const apiUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3000";

    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
