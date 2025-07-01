import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to complete even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  // You can add other Next.js config options below as needed
};

export default nextConfig;
