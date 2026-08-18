import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl = productionHost ? `https://${productionHost}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Platform Foundation · Michael John C. Revilla",
  description:
    "Benoz.AI Platform Foundation take-home: architecture review, validation library extension, and platform decisions.",
  openGraph: {
    title: "Platform Foundation · Michael John C. Revilla",
    description: "Architecture review, validation library extension, and platform decisions.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Platform Foundation — Judgment before machinery" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Platform Foundation · Michael John C. Revilla",
    description: "Architecture review, validation library extension, and platform decisions.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
