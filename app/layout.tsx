import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Inter hanya cadangan untuk SF Pro (lisensi Apple melarang memuat SF Pro sebagai berkas web).
// Dihosting sendiri (subset latin, variabel 100-900, lisensi OFL di app/fonts/INTER-LICENSE.txt) supaya `npm run build`
// dan aplikasi tidak butuh internet ke fonts.googleapis.com (build gagal di jaringan sekolah/tanpa internet).
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
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
