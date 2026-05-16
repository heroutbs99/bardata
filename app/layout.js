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
    "Generate QR codes, single barcodes, and bulk barcode sheets. Export as PNG, SVG, PDF, or CSV.",
  keywords: [
    "barcode generator",
    "QR code generator",
    "bulk barcode generator",
    "barcode PDF",
    "SKU barcode",
    "BarData",
    "Bar/Data",
  ],
  authors: [{ name: "Utsab Bhattarai" }],
  creator: "Utsab Bhattarai",
  openGraph: {
    title: "BarData — QR Code & Barcode Generator",
    description:
      "A clean QR code and barcode generator with bulk export support.",
    type: "website",
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
