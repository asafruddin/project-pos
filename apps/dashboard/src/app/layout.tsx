import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DashboardFrame } from "@/components/dashboard-frame";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-background text-foreground">
        <SessionGuard>
          <DashboardFrame>{children}</DashboardFrame>
        </SessionGuard>
      </body>
    </html>
  );
}
