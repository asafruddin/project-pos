import type { NextConfig } from "next";
import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  "dev";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // Serwist injects a webpack plugin; Next 16 Turbopack `dev` needs an explicit
  // turbopack key (empty is fine — SW is disabled outside production).
  turbopack: {},
  transpilePackages: ["@pos-apps/types", "@pos-apps/local-db"],
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default withSerwist(nextConfig);
