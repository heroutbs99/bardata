"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  QrCode,
  Barcode,
  RotateCcw,
  Copy,
  Check,
  Layers,
  FileDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

import jsPDF from "jspdf";

const barcodeFormats = [
  { label: "CODE128 — general text/SKU", value: "CODE128" },
  { label: "EAN-13 — retail product code", value: "EAN13" },
  { label: "UPC-A — North America retail", value: "UPC" },
  { label: "CODE39 — inventory/industrial", value: "CODE39" },
  { label: "ITF-14 — shipping cartons", value: "ITF14" },
  { label: "MSI — warehouse/inventory", value: "MSI" },
];

const qrPresets = [
  { label: "Website URL", value: "https://example.com" },
  { label: "Plain text", value: "Hello from BarData" },
  { label: "Email", value: "mailto:hello@example.com" },
  { label: "Phone", value: "tel:+15195550123" },
  { label: "Wi-Fi", value: "WIFI:T:WPA;S:NetworkName;P:Password123;;" },
];

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

function downloadText(text, fileName, mime = "image/svg+xml") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "generated-code"
  );
}

function getBulkItems(text) {
  return text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawBrandHeader(ctx, width, title = "BarData") {
  const logoX = 44;
  const logoY = 32;

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(logoX, logoY, 5, 36);
  ctx.fillRect(logoX + 10, logoY, 3, 36);
  ctx.fillRect(logoX + 18, logoY, 8, 36);
  ctx.fillRect(logoX + 32, logoY, 4, 36);
  ctx.fillStyle = "#06b6d4";
  ctx.fillRect(logoX + 44, logoY, 8, 36);

  ctx.fillStyle = "#0f172a";
  ctx.font = "900 34px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title, logoX + 74, logoY + 28);

  ctx.fillStyle = "#64748b";
  ctx.font = "600 15px Arial, sans-serif";
  ctx.fillText("QR Code & Barcode Generator", logoX + 74, logoY + 52);

  ctx.fillStyle = "#64748b";
  ctx.font = "700 13px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("GENERATED EXPORT", width - 44, logoY + 28);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, 104);
  ctx.lineTo(width - 36, 104);
  ctx.stroke();
}

function drawBrandFooter(ctx, width, height) {
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, height - 58);
  ctx.lineTo(width - 36, height - 58);
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = "600 14px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Generated with BarData", width / 2, height - 24);
}

function createBarcodeCanvas(value, options) {
  const canvas = document.createElement("canvas");

  const sizeValue = Number(options.size) || 320;
  const marginValue = Number(options.margin) || 2;
  const exportScale = options.exportScale || 1;

  const barcodeWidth = Math.max(1.6, (sizeValue / 320) * 2.8) * exportScale;
  const barcodeHeight = Math.max(90, sizeValue * 0.58) * exportScale;
  const barcodeFontSize = Math.max(14, sizeValue * 0.07) * exportScale;
  const barcodeMargin = marginValue * 18 * exportScale;

  JsBarcode(canvas, value, {
    format: options.format,
    lineColor: options.foreground,
    background: "#ffffff",
    width: barcodeWidth,
    height: barcodeHeight,
    displayValue: options.showValue,
    fontSize: barcodeFontSize,
    margin: barcodeMargin,
  });

  return canvas;
}

async function createQrCanvas(value, options) {
  const canvas = document.createElement("canvas");

  const sizeValue = Number(options.size) || 360;
  const marginValue = Number(options.margin) || 2;
  const exportScale = options.exportScale || 1;

  await QRCode.toCanvas(canvas, value, {
    width: Math.max(220, sizeValue) * exportScale,
    margin: marginValue,
    color: {
      dark: options.foreground,
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });

  return canvas;
}

function drawCard(ctx, x, y, width, height) {
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, x, y, width, height, 28);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.stroke();
}

async function createSingleExportCanvas({ mode, value, barcodeFormat, foreground, background, size, margin }) {
  const contentCanvas =
    mode === "qr"
      ? await createQrCanvas(value, { foreground, background, size, margin })
      : createBarcodeCanvas(value, {
          format: barcodeFormat,
          foreground,
          background,
          size,
          margin,
          showValue: true,
          exportScale: 2,
        });

  const width = Math.max(900, contentCanvas.width + 180);
  const cardWidth = width - 120;
  const cardHeight = contentCanvas.height + 120;
  const height = 124 + cardHeight + 82;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawBrandHeader(ctx, width);

  const cardX = 60;
  const cardY = 124;
  drawCard(ctx, cardX, cardY, cardWidth, cardHeight);

  const contentX = cardX + (cardWidth - contentCanvas.width) / 2;
  const contentY = cardY + (cardHeight - contentCanvas.height) / 2;
  ctx.drawImage(contentCanvas, contentX, contentY);

  drawBrandFooter(ctx, width, height);
  return canvas;
}

function makeSvgBrandHeader(width) {
  return `
    <rect width="${width}" height="124" fill="#ffffff"/>
    <rect x="44" y="32" width="5" height="36" fill="#0f172a"/>
    <rect x="54" y="32" width="3" height="36" fill="#0f172a"/>
    <rect x="62" y="32" width="8" height="36" fill="#0f172a"/>
    <rect x="76" y="32" width="4" height="36" fill="#0f172a"/>
    <rect x="88" y="32" width="8" height="36" fill="#06b6d4"/>
    <text x="118" y="60" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#0f172a">BarData</text>
    <text x="118" y="84" font-family="Arial, sans-serif" font-size="15" font-weight="600" fill="#64748b">QR Code &amp; Barcode Generator</text>
    <text x="${width - 44}" y="60" text-anchor="end" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#64748b">GENERATED EXPORT</text>
    <line x1="36" y1="104" x2="${width - 36}" y2="104" stroke="#e2e8f0"/>
  `;
}

function makeSvgFooter(width, height) {
  return `
    <line x1="36" y1="${height - 58}" x2="${width - 36}" y2="${height - 58}" stroke="#e2e8f0"/>
    <text x="${width / 2}" y="${height - 24}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="#64748b">Generated with BarData</text>
  `;
}

function makeBarcodeSvg(value, options) {
  const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(tempSvg, value, {
    format: options.format,
    lineColor: options.foreground,
    background: "#ffffff",
    width: 2.2,
    height: Math.max(120, Number(options.size) * 0.42),
    displayValue: options.showValue,
    fontSize: 18,
    margin: Number(options.margin) * 10,
  });

  return {
    width: Number(tempSvg.getAttribute("width") || 420),
    height: Number(tempSvg.getAttribute("height") || 180),
    inner: tempSvg.innerHTML,
  };
}

function createBulkExportCanvas({
  bulkItems,
  barcodeFormat,
  foreground,
  size,
  margin,
  columns,
  showBulkValue,
}) {
  const exportColumns = Math.max(1, Number(columns));
  const exportScale = 1.8;
  const previewBarcode = bulkItems.length
    ? createBarcodeCanvas(bulkItems[0], {
        format: barcodeFormat,
        foreground,
        size,
        margin,
        showValue: showBulkValue,
        exportScale,
      })
    : null;

  const cellWidth = Math.max(620, (previewBarcode?.width || 620) + 130);
  const cellHeight = Math.max(280, (previewBarcode?.height || 180) + 130);
  const gap = 28;
  const padding = 48;
  const headerHeight = 124;
  const footerHeight = 76;
  const rows = Math.max(1, Math.ceil(bulkItems.length / exportColumns));
  const width = padding * 2 + exportColumns * cellWidth + (exportColumns - 1) * gap;
  const height = headerHeight + padding + rows * cellHeight + (rows - 1) * gap + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawBrandHeader(ctx, width);

  bulkItems.forEach((item, index) => {
    const col = index % exportColumns;
    const row = Math.floor(index / exportColumns);
    const x = padding + col * (cellWidth + gap);
    const y = headerHeight + padding + row * (cellHeight + gap);

    drawCard(ctx, x, y, cellWidth, cellHeight);

    const barcodeCanvas = createBarcodeCanvas(item, {
      format: barcodeFormat,
      foreground,
      background: "#ffffff",
      size,
      margin,
      showValue: showBulkValue,
      exportScale,
    });

    const bx = x + (cellWidth - barcodeCanvas.width) / 2;
    const by = y + (cellHeight - barcodeCanvas.height) / 2;
    ctx.drawImage(barcodeCanvas, bx, by);
  });

  drawBrandFooter(ctx, width, height);
  return canvas;
}

function BarcodePreview({
  value,
  format,
  foreground,
  background,
  size,
  margin,
  showValue = true,
  onError,
}) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      svgRef.current.innerHTML = "";

      JsBarcode(svgRef.current, value, {
        format,
        lineColor: foreground,
        background,
        width: 2,
        height: Math.max(84, Number(size) * 0.32),
        displayValue: showValue,
        fontSize: 15,
        margin: Number(margin) * 8,
      });
    } catch (err) {
      if (onError) onError(value);
    }
  }, [value, format, foreground, background, size, margin, showValue, onError]);

  return <svg ref={svgRef} className="h-auto w-full max-w-full" />;
}

export default function BarcodeQrGeneratorApp() {
  const [mode, setMode] = useState("bulk");
  const [value, setValue] = useState("https://example.com");
  const [bulkValues, setBulkValues] = useState(
    "SKU-1001\nSKU-1002\nSKU-1003\nSKU-1004\nSKU-1005\nSKU-1006"
  );
  const [barcodeFormat, setBarcodeFormat] = useState("CODE128");
  const [foreground, setForeground] = useState("#111827");
  const [background, setBackground] = useState("#ffffff");
  const [size, setSize] = useState(220);
  const [margin, setMargin] = useState(3);
  const [columns, setColumns] = useState(3);
  const [showBulkValue, setShowBulkValue] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [bulkErrors, setBulkErrors] = useState([]);
  const [copied, setCopied] = useState(false);

  const barcodeRef = useRef(null);
  const previewRef = useRef(null);
  const bulkSheetRef = useRef(null);

  const bulkItems = useMemo(() => getBulkItems(bulkValues), [bulkValues]);
  const fileBase = useMemo(() => safeFileName(`${mode}-${value}`), [mode, value]);

  useEffect(() => {
    setError("");

    if (mode === "bulk") return;

    if (!value.trim()) {
      setError("Enter some data to generate a code.");
      setQrDataUrl("");

      if (barcodeRef.current) {
        barcodeRef.current.innerHTML = "";
      }

      return;
    }

    if (mode === "qr") {
      QRCode.toDataURL(value, {
        width: Number(size),
        margin: Number(margin),
        color: {
          dark: foreground,
          light: background,
        },
        errorCorrectionLevel: "H",
      })
        .then(setQrDataUrl)
        .catch(() => setError("Could not generate this QR code."));
    }

    if (mode === "barcode" && barcodeRef.current) {
      try {
        barcodeRef.current.innerHTML = "";

        JsBarcode(barcodeRef.current, value, {
          format: barcodeFormat,
          lineColor: foreground,
          background,
          width: 2.2,
          height: Math.max(120, Number(size) * 0.45),
          displayValue: true,
          fontSize: 18,
          margin: Number(margin) * 10,
        });
      } catch (err) {
        setError(
          barcodeFormat === "EAN13"
            ? "EAN-13 needs exactly 12 or 13 digits. Example: 5901234123457"
            : barcodeFormat === "UPC"
              ? "UPC-A needs exactly 11 or 12 digits. Example: 123456789012"
              : "This value is not valid for the selected barcode format. Try CODE128 for general text."
        );
      }
    }
  }, [mode, value, barcodeFormat, foreground, background, size, margin]);

  useEffect(() => {
    if (mode !== "bulk") return;
    setBulkErrors([]);
  }, [mode, bulkValues, barcodeFormat]);

  const reset = () => {
    setMode("bulk");
    setValue("https://example.com");
    setBulkValues("SKU-1001\nSKU-1002\nSKU-1003\nSKU-1004\nSKU-1005\nSKU-1006");
    setBarcodeFormat("CODE128");
    setForeground("#111827");
    setBackground("#ffffff");
    setSize(220);
    setMargin(3);
    setColumns(3);
    setShowBulkValue(true);
    setError("");
    setBulkErrors([]);
  };

  const copyValue = async () => {
    await navigator.clipboard.writeText(mode === "bulk" ? bulkValues : value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const downloadPng = async () => {
    try {
      const canvas =
        mode === "bulk"
          ? createBulkExportCanvas({
              bulkItems,
              barcodeFormat,
              foreground,
              size,
              margin,
              columns,
              showBulkValue,
            })
          : await createSingleExportCanvas({
              mode,
              value,
              barcodeFormat,
              foreground,
              background,
              size,
              margin,
            });

      downloadDataUrl(
        canvas.toDataURL("image/png"),
        mode === "bulk" ? "bardata-bulk-barcodes.png" : `${fileBase}-bardata.png`
      );
    } catch (err) {
      console.error("PNG export failed:", err);
      setError("Could not export PNG. Check the barcode value and format.");
    }
  };

  const downloadSvg = async () => {
    try {
      if (mode === "qr") {
        const qrSvg = await QRCode.toString(value, {
          type: "svg",
          margin: Number(margin),
          color: {
            dark: foreground,
            light: background,
          },
          errorCorrectionLevel: "H",
        });

        const qrInner = qrSvg.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");
        const width = 900;
        const height = 880;

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  ${makeSvgBrandHeader(width)}
  <rect x="120" y="150" width="660" height="620" rx="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <g transform="translate(210 205) scale(1.6)">
    ${qrInner}
  </g>
  ${makeSvgFooter(width, height)}
</svg>`;

        downloadText(svg, `${fileBase}-bardata.svg`);
        return;
      }

      if (mode === "barcode") {
        const barcode = makeBarcodeSvg(value, {
          format: barcodeFormat,
          foreground,
          size,
          margin,
          showValue: true,
          exportScale: 2,
        });
        const width = Math.max(900, barcode.width + 180);
        const cardWidth = width - 120;
        const cardHeight = barcode.height + 120;
        const height = 124 + cardHeight + 82;
        const x = 60;
        const y = 124;
        const bx = x + (cardWidth - barcode.width) / 2;
        const by = y + (cardHeight - barcode.height) / 2;

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  ${makeSvgBrandHeader(width)}
  <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <g transform="translate(${bx} ${by})">
    ${barcode.inner}
  </g>
  ${makeSvgFooter(width, height)}
</svg>`;

        downloadText(svg, `${fileBase}-bardata.svg`);
        return;
      }

      const exportColumns = Math.max(1, Number(columns));
      const cellWidth = 560;
      const cellHeight = 250;
      const gap = 28;
      const padding = 48;
      const headerHeight = 124;
      const footerHeight = 76;
      const rows = Math.max(1, Math.ceil(bulkItems.length / exportColumns));
      const width = padding * 2 + exportColumns * cellWidth + (exportColumns - 1) * gap;
      const height = headerHeight + padding + rows * cellHeight + (rows - 1) * gap + footerHeight;

      const cells = bulkItems
        .map((item, index) => {
          const barcode = makeBarcodeSvg(item, {
            format: barcodeFormat,
            foreground,
            size,
            margin,
            showValue: showBulkValue,
          });
          const col = index % exportColumns;
          const row = Math.floor(index / exportColumns);
          const x = padding + col * (cellWidth + gap);
          const y = headerHeight + padding + row * (cellHeight + gap);
          const bx = x + (cellWidth - barcode.width) / 2;
          const by = y + (cellHeight - barcode.height) / 2;

          return `
            <rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" rx="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
            <g transform="translate(${bx} ${by})">
              ${barcode.inner}
            </g>
          `;
        })
        .join("\n");

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  ${makeSvgBrandHeader(width)}
  ${cells}
  ${makeSvgFooter(width, height)}
</svg>`;

      downloadText(svg, "bardata-bulk-barcodes.svg");
    } catch (err) {
      console.error("SVG export failed:", err);
      setError("Could not export SVG. Check the barcode value and format.");
    }
  };

  const downloadCsv = () => {
    const csvRows = [
      "value",
      ...bulkItems.map((item) => `"${item.replace(/"/g, '""')}"`),
    ];

    downloadText(csvRows.join("\n"), "bardata-bulk-barcode-values.csv", "text/csv");
  };

  const downloadBulkPdf = async () => {
    if (mode !== "bulk" || bulkErrors.length) return;

    try {
      const canvas = createBulkExportCanvas({
        bulkItems,
        barcodeFormat,
        foreground,
        size,
        margin,
        columns,
        showBulkValue,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidthMm = pdf.internal.pageSize.getWidth();
      const pageHeightMm = pdf.internal.pageSize.getHeight();
      const marginMm = 6;
      const usableWidthMm = pageWidthMm - marginMm * 2;
      const usableHeightMm = pageHeightMm - marginMm * 2;
      const sliceHeightPx = Math.floor((usableHeightMm / usableWidthMm) * canvas.width);

      let positionY = 0;
      let pageIndex = 0;

      while (positionY < canvas.height) {
        const currentSliceHeight = Math.min(sliceHeightPx, canvas.height - positionY);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSliceHeight;

        const ctx = sliceCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          positionY,
          canvas.width,
          currentSliceHeight,
          0,
          0,
          canvas.width,
          currentSliceHeight
        );

        const imgData = sliceCanvas.toDataURL("image/png");
        const sliceHeightMm = (currentSliceHeight * usableWidthMm) / canvas.width;

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "PNG", marginMm, marginMm, usableWidthMm, sliceHeightMm);
        positionY += currentSliceHeight;
        pageIndex += 1;
      }

      pdf.save("bardata-bulk-barcodes.pdf");
    } catch (err) {
      console.error("PDF export failed:", err);
      setError("Could not export PDF. Check the barcode value and format.");
    }
  };

  const addBulkError = (invalidValue) => {
    setBulkErrors((prev) =>
      prev.includes(invalidValue) ? prev : [...prev, invalidValue]
    );
  };

  return (
    <main className="soft-texture relative min-h-screen overflow-hidden bg-[var(--app-bg)] font-sans text-[var(--app-text)] transition-colors duration-300 xl:overflow-visible">
      <style jsx global>{`
        :root {
          --app-bg: #eef7ff;
          --app-surface: rgba(255, 255, 255, 0.62);
          --app-surface-2: rgba(255, 255, 255, 0.38);
          --app-panel: rgba(255, 255, 255, 0.48);
          --app-text: #0f172a;
          --app-muted: #64748b;
          --app-border: rgba(15, 23, 42, 0.14);
          --app-accent: #06b6d4;
          --app-accent-soft: rgba(6, 182, 212, 0.14);
          --app-shadow: 0 24px 90px rgba(15, 23, 42, 0.14);
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --app-bg: #030712;
            --app-surface: rgba(17, 24, 39, 0.68);
            --app-surface-2: rgba(15, 23, 42, 0.48);
            --app-panel: rgba(31, 35, 51, 0.52);
            --app-text: #f8fafc;
            --app-muted: #a7b0c0;
            --app-border: rgba(255, 255, 255, 0.12);
            --app-accent: #22d3ee;
            --app-accent-soft: rgba(34, 211, 238, 0.14);
            --app-shadow: 0 28px 90px rgba(0, 0, 0, 0.38);
          }
        }

        html {
          background: var(--app-bg);
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        body,
        button,
        input,
        textarea,
        select {
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        input[type="range"] {
          accent-color: var(--app-accent);
        }

        .glass-card {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.58),
            rgba(255, 255, 255, 0.28)
          );
          backdrop-filter: blur(24px) saturate(140%);
          -webkit-backdrop-filter: blur(24px) saturate(140%);
        }

        @media (prefers-color-scheme: dark) {
          .glass-card {
            background: linear-gradient(
              135deg,
              rgba(17, 24, 39, 0.68),
              rgba(15, 23, 42, 0.38)
            );
          }
        }

        .soft-texture {
          background-image:
            radial-gradient(circle at 20% 15%, rgba(34, 211, 238, 0.22), transparent 28%),
            radial-gradient(circle at 85% 18%, rgba(59, 130, 246, 0.18), transparent 30%),
            radial-gradient(circle at 50% 90%, rgba(14, 165, 233, 0.14), transparent 35%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, transparent 100%);
        }

        .soft-texture::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.22;
          background-image:
            linear-gradient(rgba(15, 23, 42, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15, 23, 42, 0.06) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: linear-gradient(to bottom, black, transparent 85%);
        }

        @media (prefers-color-scheme: dark) {
          .soft-texture::before {
            opacity: 0.18;
            background-image:
              linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
          }
        }

        .bulk-grid {
          grid-template-columns: 1fr;
        }

        @media (min-width: 768px) {
          .bulk-grid {
            grid-template-columns: repeat(var(--bulk-columns), minmax(0, 1fr));
          }
        }
      `}</style>

      <section className="relative mx-auto flex min-h-screen w-full max-w-[1800px] flex-col overflow-hidden px-4 py-4 sm:px-5 lg:px-7 xl:min-h-0 xl:overflow-visible xl:px-8">
        <div className="pointer-events-none absolute left-[-120px] top-[-120px] h-[340px] w-[340px] rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-140px] right-[-120px] h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-3xl" />

        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="glass-card relative z-10 mb-4 rounded-[1.5rem] border border-[var(--app-border)] p-4 shadow-[var(--app-shadow)] lg:p-5"
        >
          <nav className="mb-4 flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--app-border)] bg-[var(--app-accent-soft)] px-3.5 py-2 text-sm font-black text-[var(--app-text)]">
              <svg
                width="26"
                height="26"
                viewBox="0 0 32 32"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                <rect x="3" y="6" width="3" height="20" rx="1" fill="currentColor" />
                <rect x="8" y="6" width="1.8" height="20" rx="0.9" fill="currentColor" />
                <rect x="12" y="6" width="4" height="20" rx="1" fill="currentColor" />
                <rect x="18" y="6" width="2" height="20" rx="1" fill="currentColor" />
                <rect x="23" y="6" width="6" height="20" rx="1" fill="var(--app-accent)" />
              </svg>
              <span>BarData</span>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-2 text-xs font-bold text-[var(--app-muted)] sm:flex">
              <span className="h-2 w-2 rounded-full bg-[var(--app-accent)]" />
              Client-side generator
            </div>
          </nav>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                QR · Barcode · Bulk sheets
              </div>

              <h1 className="max-w-3xl text-balance text-2xl font-black leading-tight tracking-[-0.03em] text-[var(--app-text)] md:text-3xl">
                Generate codes that are ready to scan, print, and share.
              </h1>

              <p className="max-w-2xl text-sm leading-6 text-[var(--app-muted)] md:text-base">
                A polished QR and barcode tool for labels, SKUs, product sheets,
                inventory workflows, Wi-Fi, links, emails, and quick exports.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface-2)]/70 p-2 backdrop-blur-xl">
              <div className="rounded-xl bg-[var(--app-surface)] p-2.5 text-center">
                <div className="text-base font-black text-[var(--app-text)]">PNG</div>
                <div className="text-[10px] font-semibold text-[var(--app-muted)]">
                  Export
                </div>
              </div>
              <div className="rounded-xl bg-[var(--app-surface)] p-2.5 text-center">
                <div className="text-base font-black text-[var(--app-text)]">SVG</div>
                <div className="text-[10px] font-semibold text-[var(--app-muted)]">
                  Vector
                </div>
              </div>
              <div className="rounded-xl bg-[var(--app-surface)] p-2.5 text-center">
                <div className="text-base font-black text-[var(--app-text)]">PDF</div>
                <div className="text-[10px] font-semibold text-[var(--app-muted)]">
                  Bulk
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        <div className="relative z-10 grid flex-1 gap-4 xl:grid-cols-[0.72fr_1.28fr] xl:items-start">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="min-h-0 min-w-0 xl:sticky xl:top-4 xl:self-start"
          >
            <Card className="glass-card h-auto overflow-hidden rounded-[2rem] border border-[var(--app-border)] shadow-[var(--app-shadow)]">
              <CardContent className="h-auto p-4 md:p-5 xl:p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 rounded-[1.5rem] border border-[var(--app-border)] bg-[var(--app-surface-2)]/70 p-1.5 backdrop-blur-xl sm:p-2">
                    <button
                      onClick={() => setMode("qr")}
                      className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold transition sm:px-3 sm:text-sm ${
                        mode === "qr"
                          ? "bg-[var(--app-accent)] text-slate-950 shadow-lg"
                          : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                      }`}
                    >
                      <QrCode size={18} /> QR
                    </button>

                    <button
                      onClick={() => setMode("barcode")}
                      className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold transition sm:px-3 sm:text-sm ${
                        mode === "barcode"
                          ? "bg-[var(--app-accent)] text-slate-950 shadow-lg"
                          : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                      }`}
                    >
                      <Barcode size={18} /> Single
                    </button>

                    <button
                      onClick={() => setMode("bulk")}
                      className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold transition sm:px-3 sm:text-sm ${
                        mode === "bulk"
                          ? "bg-[var(--app-accent)] text-slate-950 shadow-lg"
                          : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                      }`}
                    >
                      <Layers size={18} /> Bulk
                    </button>
                  </div>

                  {mode === "qr" && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[var(--app-text)]">
                        Quick QR preset
                      </label>
                      <select
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Choose a preset
                        </option>
                        {qrPresets.map((preset) => (
                          <option key={preset.label} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(mode === "barcode" || mode === "bulk") && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[var(--app-text)]">
                        Barcode format
                      </label>
                      <select
                        value={barcodeFormat}
                        onChange={(e) => setBarcodeFormat(e.target.value)}
                        className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                      >
                        {barcodeFormats.map((format) => (
                          <option key={format.value} value={format.value}>
                            {format.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {mode !== "bulk" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-bold text-[var(--app-text)]">
                          Data to encode
                        </label>
                        <button
                          onClick={copyValue}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--app-accent)]"
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        rows={4}
                        placeholder="Enter URL, text, SKU, product ID, phone, email, Wi-Fi string..."
                        className="w-full resize-none rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)]"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-bold text-[var(--app-text)]">
                          Bulk barcode values
                        </label>
                        <span className="text-xs font-medium text-[var(--app-muted)]">
                          {bulkItems.length} item{bulkItems.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <textarea
                        value={bulkValues}
                        onChange={(e) => setBulkValues(e.target.value)}
                        rows={6}
                        placeholder={
                          "Paste one barcode value per line.\nSKU-1001\nSKU-1002\nSKU-1003"
                        }
                        className="w-full resize-none rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)]"
                      />
                      <p className="text-xs leading-5 text-[var(--app-muted)]">
                        For mixed letters/numbers, use CODE128. EAN-13, UPC, and
                        ITF-14 require specific digit lengths.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[var(--app-text)]">
                        Foreground
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={foreground}
                          onChange={(e) => setForeground(e.target.value)}
                          className="h-11 w-14 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1"
                        />
                        <input
                          value={foreground}
                          onChange={(e) => setForeground(e.target.value)}
                          className="min-w-0 flex-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[var(--app-text)]">
                        Background
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={background}
                          onChange={(e) => setBackground(e.target.value)}
                          className="h-11 w-14 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1"
                        />
                        <input
                          value={background}
                          onChange={(e) => setBackground(e.target.value)}
                          className="min-w-0 flex-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="flex justify-between text-sm font-bold text-[var(--app-text)]">
                        Size <span className="text-[var(--app-muted)]">{size}px</span>
                      </label>
                      <input
                        type="range"
                        min="220"
                        max="620"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex justify-between text-sm font-bold text-[var(--app-text)]">
                        Margin <span className="text-[var(--app-muted)]">{margin}</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="8"
                        value={margin}
                        onChange={(e) => setMargin(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {mode === "bulk" && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="flex justify-between text-sm font-bold text-[var(--app-text)]">
                          Sheet columns{" "}
                          <span className="text-[var(--app-muted)]">{columns}</span>
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={columns}
                          onChange={(e) => setColumns(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <label className="flex items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm font-medium text-[var(--app-text)]">
                        <input
                          type="checkbox"
                          checked={showBulkValue}
                          onChange={(e) => setShowBulkValue(e.target.checked)}
                          className="accent-cyan-400"
                        />
                        Show value below barcode
                      </label>
                    </div>
                  )}

                  {error && (
                    <p className="rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-500">
                      {error}
                    </p>
                  )}

                  {mode === "bulk" && bulkErrors.length > 0 && (
                    <p className="rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-500">
                      Some values are invalid for {barcodeFormat}:{" "}
                      {bulkErrors.slice(0, 4).join(", ")}
                      {bulkErrors.length > 4 ? "..." : ""}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      onClick={downloadPng}
                      className="rounded-2xl bg-[var(--app-accent)] px-4 font-bold text-slate-950 hover:opacity-90"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {mode === "bulk" ? "Sheet PNG" : "PNG"}
                    </Button>

                    <Button
                      onClick={downloadSvg}
                      variant="secondary"
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-2)]"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {mode === "bulk" ? "Sheet SVG" : "SVG"}
                    </Button>

                    {mode === "bulk" && (
                      <>
                        <Button
                          onClick={downloadBulkPdf}
                          variant="secondary"
                          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-2)]"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          PDF
                        </Button>

                        <Button
                          onClick={downloadCsv}
                          variant="secondary"
                          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-2)]"
                        >
                          <FileDown className="mr-2 h-4 w-4" />
                          CSV
                        </Button>
                      </>
                    )}

                    <Button
                      onClick={reset}
                      variant="ghost"
                      className="rounded-2xl px-4 font-bold text-[var(--app-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="min-h-0 min-w-0"
          >
            <Card className="glass-card h-auto overflow-hidden rounded-[2rem] border border-[var(--app-border)] shadow-[var(--app-shadow)]">
              <CardContent className="flex h-auto flex-col gap-4 p-4 md:p-5 xl:p-6">
                <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-2xl font-black tracking-[-0.03em] text-[var(--app-text)] md:text-3xl">
                      Live preview
                    </h2>
                    <p className="mt-1 text-sm text-[var(--app-muted)]">
                      Scroll this preview area while your data panel stays still.
                    </p>
                  </div>

                  <div className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-muted)] md:w-auto">
                    {mode === "bulk"
                      ? `${bulkItems.length} bulk items`
                      : mode === "qr"
                        ? "QR export"
                        : `${barcodeFormat} export`}
                  </div>
                </div>

                <div className="min-h-[560px] flex-1 overflow-x-hidden rounded-[2rem] border border-[var(--app-border)] bg-[var(--app-surface-2)]/70 p-3 shadow-inner backdrop-blur-xl md:min-h-[680px] md:p-5 xl:min-h-[500px] xl:max-h-[calc(100vh-220px)] xl:overflow-y-auto xl:p-7">
                  {mode !== "bulk" ? (
                    <div
                      ref={previewRef}
                      className="flex min-h-[520px] w-full items-center justify-center rounded-[1.65rem] p-6 shadow-sm md:min-h-[680px] md:p-8 xl:min-h-[760px]"
                      style={{ backgroundColor: background }}
                    >
                      {mode === "qr" ? (
                        qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="Generated QR code"
                            className="h-auto w-full max-w-[min(620px,90%)]"
                          />
                        ) : (
                          <div className="text-center text-slate-500">
                            QR preview will appear here
                          </div>
                        )
                      ) : (
                        <div className="w-full max-w-[820px]">
                          <svg ref={barcodeRef} className="h-auto w-full max-w-full" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      ref={bulkSheetRef}
                      className="mx-auto w-full max-w-[1150px] rounded-[1.65rem] p-4 shadow-sm sm:p-5 md:p-7"
                      style={{ backgroundColor: background }}
                    >
                      {bulkItems.length ? (
                        <div
                          className="bulk-grid grid gap-4 md:gap-5"
                          style={{ "--bulk-columns": columns }}
                        >
                          {bulkItems.map((item, index) => (
                            <div
                              key={`${item}-${index}`}
                              className="flex min-h-[165px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 sm:min-h-[190px] sm:p-5"
                            >
                              <BarcodePreview
                                value={item}
                                format={barcodeFormat}
                                foreground={foreground}
                                background="#ffffff"
                                size={size}
                                margin={margin}
                                showValue={showBulkValue}
                                onError={addBulkError}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-[420px] items-center justify-center text-center text-slate-500">
                          Paste one barcode value per line to generate a bulk sheet.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      <footer className="relative z-10 w-full border-t border-[var(--app-border)] bg-[var(--app-surface)]/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] flex-col items-center justify-between gap-3 px-6 py-4 sm:flex-row sm:gap-2">
          <p className="text-xs text-[var(--app-muted)]">
            © {new Date().getFullYear()} BarData. All rights reserved.
          </p>
          <a
            href="https://tcfella.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--app-muted)] transition hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
          >
            <img src="/tcf-logo.svg" alt="The Creative Fella" className="h-4 w-4 object-contain" />
            Designed &amp; maintained by The Creative Fella
          </a>
        </div>
      </footer>
    </main>
  );
}
