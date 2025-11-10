import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Supabase Agents Observatory",
  description:
    "Monitor multi-agent logs and generated documents for automated code generation pipelines."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased bg-slate-950 text-slate-100`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

