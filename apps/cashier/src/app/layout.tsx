import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PrefBootstrap } from "@/components/pref-bootstrap";
import { CartProvider } from "@/components/cart-context";
import { SessionGuard } from "@/components/session-guard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_NAME = "POS Apps Cashier";
const APP_DEFAULT_TITLE = "POS Apps Cashier";
const APP_TITLE_TEMPLATE = "%s · POS Apps Cashier";
const APP_DESCRIPTION = "Coffee-shop POS cashier scaffold";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_DEFAULT_TITLE,
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1D4ED8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <PrefBootstrap>
          <SessionGuard>
            <CartProvider>{children}</CartProvider>
          </SessionGuard>
        </PrefBootstrap>
      </body>
    </html>
  );
}
