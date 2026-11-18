import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Inter hanya cadangan untuk SF Pro (lisensi Apple melarang memuat SF Pro sebagai berkas web).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Classmeet Market",
    template: "%s · Classmeet Market",
  },
  description: "Simulasi bursa saham dan game pos untuk lomba classmeet.",
};

export const viewport: Viewport = {
  themeColor: "#F3F6FF",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} h-full`}>
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body className="bg-page text-ink flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
