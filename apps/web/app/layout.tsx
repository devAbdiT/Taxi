import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import "./globals.css";

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
  title: "MengedLink",
  description: "Shared taxi queues across Jimma.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1D4E9E",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${notoLatin.variable} ${notoEthiopic.variable} h-full antialiased`}>
      <body className="min-h-full bg-cream text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
