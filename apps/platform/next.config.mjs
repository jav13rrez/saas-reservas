import process from "node:process";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The platform surface is a distinct origin with its own session cookie
  // (platform_session), structurally separate from the tenant admin console
  // (FR-012). Only the versioned platform/ops Fastify routes are proxied; the
  // API re-validates the platform session on every request. SECURITY: a
  // production edge proxy MUST strip inbound X-Forwarded-Host before this hop.
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
