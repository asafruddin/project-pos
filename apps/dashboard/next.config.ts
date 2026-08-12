import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pos-apps/types"],
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default nextConfig;
