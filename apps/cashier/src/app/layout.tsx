import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@pos-apps/ui/molecules/sonner";
import { TooltipProvider } from "@pos-apps/ui/molecules/tooltip";
import { PrefBootstrap } from "@/components/providers/pref-bootstrap";
import { CartProvider } from "@/components/providers/cart-context";
import { SessionGuard } from "@/components/providers/session-guard";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_NAME = "POS Apps Cashier";
const APP_DEFAULT_TITLE = "POS Apps Cashier";
const APP_TITLE_TEMPLATE = "%s · POS Apps Cashier";
const APP_DESCRIPTION = "Coffee-shop POS cashier scaffold";

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("pos_cashier_theme");var d=t==="dark"||((t==null||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

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
  themeColor: "#f97316",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex h-full min-h-full flex-col bg-background font-sans text-foreground">
        <TooltipProvider>
          <PrefBootstrap>
            <SessionGuard>
              <CartProvider>{children}</CartProvider>
            </SessionGuard>
          </PrefBootstrap>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
