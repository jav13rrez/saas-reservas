import process from "node:process";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy only the versioned Fastify routes (/api/v1/*) to the API service;
  // tenant identity comes from the Host header, which the API re-validates on
  // every request. Local Next.js route handlers (/api/services, /api/bookings,
  // /api/ops, /api/audit) are intentionally NOT proxied so the console runs
  // with a single `pnpm dev`. Note: array rewrites are afterFiles and run
  // before dynamic routes, so a broad /api/:path* would shadow our own dynamic
  // handlers like /api/services/[id].
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_ORIGIN ?? "http://localhost:3001"}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
