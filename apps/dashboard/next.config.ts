import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  
  /** Proxy API calls to the Recurrsive server. */
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
