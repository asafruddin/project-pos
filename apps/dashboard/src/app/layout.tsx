import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@pos-apps/ui/molecules/sonner";
import { TooltipProvider } from "@pos-apps/ui/molecules/tooltip";
import { DashboardFrame } from "@/components/templates/dashboard-frame";
import { SessionGuard } from "@/components/providers/session-guard";
import { ThemeProvider } from "@/components/providers/theme-provider";
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

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("pos-dashboard-theme");var d=t==="dark"||((t==null||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export const metadata: Metadata = {
  title: {
    default: "POS Apps Dashboard",
    template: "%s · POS Apps Dashboard",
  },
  description: "Coffee-shop POS dashboard scaffold",
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
      <body className="h-full bg-background font-sans text-foreground">
        <ThemeProvider>
          <TooltipProvider>
            <SessionGuard>
              <DashboardFrame>{children}</DashboardFrame>
            </SessionGuard>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
