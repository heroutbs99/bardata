# Bar/Data

Bar/Data is a clean QR code and barcode generator built with Next.js. It supports single QR codes, single barcodes, and bulk barcode sheet generation with export options for PNG, SVG, PDF, and CSV.

## Live Demo

https://bardata.vercel.app

Replace the link above with your real Vercel link.

## Features

- Generate QR codes for URLs, text, email, phone numbers, and Wi-Fi
- Generate single barcodes
- Generate bulk barcode sheets from line-by-line values
- Export as PNG
- Export as SVG
- Export bulk barcode sheets as PDF
- Export bulk values as CSV
- System light/dark mode support
- Responsive layout for desktop and mobile
- Client-side generation with no backend required

## Supported Barcode Formats

| Format | Best For | Example |
|---|---|---|
| CODE128 | General text, SKUs, inventory codes | `SKU-1001` |
| CODE39 | Basic inventory and industrial labels | `ABC-123` |
| EAN-13 | Retail product codes | `5901234123457` |
| UPC-A | North American retail product codes | `123456789012` |
| ITF-14 | Shipping cartons and packaging | `10012345678902` |
| MSI | Numeric inventory systems | `1234567890` |

> Some barcode formats require specific numeric lengths. If unsure, use CODE128 for general-purpose text and SKU values.

## Tech Stack

- Next.js
- React
- Tailwind CSS
- shadcn/ui
- Lucide React
- QRCode
- JsBarcode
- html-to-image
- jsPDF
- Vercel

## Installation

Clone the repository:

```bash
git clone https://github.com/heroutbs99/bardata.git
cd bardata