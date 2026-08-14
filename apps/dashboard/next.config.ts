import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pos-apps/types", "@pos-apps/ui"],
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "@pos-apps/ui"],
  },
};

export default nextConfig;
