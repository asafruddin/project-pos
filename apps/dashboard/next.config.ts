import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pos-apps/types"],
};

export default nextConfig;
