# BarData

BarData is a client-side QR code and barcode generator built with Next.js. It supports single codes and bulk QR or barcode sheets with PNG, SVG, and PDF exports.

## Live Demo

[www.bardata.app](https://www.bardata.app)

## Features

- Generate QR codes for URLs, text, email, phone numbers, and Wi-Fi
- Generate single barcodes
- Generate bulk QR and barcode sheets from line-by-line values
- Export single codes and bulk sheets as PNG or SVG
- Export bulk sheets as PDF
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
- jsPDF
- Vercel

## Local Development

Requirements: Node.js 20 or newer and npm.

Clone the repository:

```bash
git clone https://github.com/heroutbs99/bardata.git
cd bardata
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build

```bash
npm run build
npm start
```

## Available Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates an optimized production build.
- `npm start` serves the production build.
- `npm run lint` checks the project with ESLint.

## Privacy

Code generation and export happen entirely in the browser. BarData does not require a backend or account.
