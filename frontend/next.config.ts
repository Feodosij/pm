import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  turbopack: {
    root: __dirname,
  },
  // In dev mode, proxy /api/* to the FastAPI backend on :8000.
  // (rewrites are ignored in static exports; they only run in `next dev`)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },
};

export default nextConfig;
