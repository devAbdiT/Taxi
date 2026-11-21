import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/Header";
import "./globals.css";

// Noto Sans Ethiopic, self-hosted (from @fontsource-variable/noto-sans-ethiopic, OFL licence in app/fonts).
// Split in two families so English pages only download the small Latin file.
const notoLatin = localFont({
  src: "./fonts/noto-sans-ethiopic-latin-wght-normal.woff2",
  variable: "--font-noto-latin",
  weight: "100 900",
  display: "swap",
});
const notoEthiopic = localFont({
  src: "./fonts/noto-sans-ethiopic-ethiopic-wght-normal.woff2",
  variable: "--font-noto-ethiopic",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TaxiFlow",
  description: "Shared taxi queue and live passenger demand",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#047857",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${notoLatin.variable} ${notoEthiopic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <Header />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
