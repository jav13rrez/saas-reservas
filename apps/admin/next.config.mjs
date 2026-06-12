import process from "node:process";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The admin app talks to the API service; tenant identity comes from the
  // Host header, which the API re-validates on every request.
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
