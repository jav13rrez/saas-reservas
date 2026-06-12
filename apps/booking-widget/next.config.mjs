import process from "node:process";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The widget is served under the tenant's (sub)domain; the API re-validates
  // tenant identity from the Host header on every request.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_ORIGIN ?? "http://localhost:3001"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
