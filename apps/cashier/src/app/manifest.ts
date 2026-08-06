import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "POS Apps Cashier",
    short_name: "Cashier",
    description: "Coffee-shop POS cashier — Instant Checkout scaffold",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1D4ED8",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
