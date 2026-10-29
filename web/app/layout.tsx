import type { Metadata } from "next";
import { Host_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";

const host = Host_Grotesk({
  subsets: ["latin"],
  variable: "--font-host",
  display: "swap",
});
const geist = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ACH — Autonomous Clearing House",
  description:
    "The clearing house for the agent economy. Multilateral netting and atomic settlement for AI agents on NEAR.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${host.variable} ${geist.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
