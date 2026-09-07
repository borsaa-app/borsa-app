import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "BIST AI Yatırım Terminali — Gerçek Zamanlı Analiz & Uyarı Ajanı",
  description:
    "Borsa İstanbul hisselerini gerçek piyasa verisiyle izleyen, teknik + temel + haber analizi yapan, portföy takibi, kâr/zarar uyarıları ve senaryo bazlı tahminler sunan AI yatırım terminali. Yatırım tavsiyesi değildir.",
  keywords: ["BIST", "Borsa İstanbul", "hisse", "yatırım", "teknik analiz", "portföy", "Midas", "AI"],
  manifest: "/manifest.json",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0e17] text-slate-200`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
