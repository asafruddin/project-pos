import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const revision = crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Serwist injects a webpack plugin; Next 16 Turbopack `dev` needs an explicit
  // turbopack key (empty is fine — SW is disabled in development).
  turbopack: {},
  transpilePackages: ["@pos-apps/types", "@pos-apps/local-db"],
};

export default withSerwist(nextConfig);
