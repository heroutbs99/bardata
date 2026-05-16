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

export const metadata = {
  title: "BarData — QR Code & Barcode Generator",
  description:
    "Generate QR codes, single barcodes, and bulk barcode sheets. Export as PNG, SVG, or PDF — free, client-side, no sign-up. Made by The Creative Fella.",
  keywords: [
    "barcode generator",
    "QR code generator",
    "bulk barcode generator",
    "barcode PDF",
    "SKU barcode",
    "BarData",
    "The Creative Fella",
    "tcfella",
  ],
  authors: [{ name: "Utsab Bhattarai", url: "https://tcfella.com" }],
  creator: "Utsab Bhattarai",
  metadataBase: new URL("https://bardata.tcfella.com"),
  openGraph: {
    title: "BarData — QR Code & Barcode Generator",
    description:
      "Free QR code and barcode generator with bulk export. PNG, SVG, PDF — no sign-up needed. Made by The Creative Fella.",
    type: "website",
    url: "https://bardata.tcfella.com",
    siteName: "BarData",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BarData — QR Code & Barcode Generator by The Creative Fella",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BarData — QR Code & Barcode Generator",
    description:
      "Free QR code and barcode generator with bulk export. PNG, SVG, PDF — no sign-up needed. Made by The Creative Fella.",
    images: ["/og-image.png"],
    creator: "@tcfella",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
