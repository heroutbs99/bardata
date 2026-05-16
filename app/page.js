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
  ctx.fillStyle = "#ffc200";
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

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 13px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Generated with BarData", 44, height - 24);

  ctx.fillStyle = "#ffc200";
  ctx.font = "700 13px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("by tcfella.com", width - 44, height - 24);
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
    <rect x="88" y="32" width="8" height="36" fill="#ffc200"/>
    <text x="118" y="60" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#0f172a">BarData</text>
    <text x="118" y="84" font-family="Arial, sans-serif" font-size="15" font-weight="600" fill="#64748b">QR Code &amp; Barcode Generator</text>
    <text x="${width - 44}" y="60" text-anchor="end" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#64748b">GENERATED EXPORT</text>
    <line x1="36" y1="104" x2="${width - 36}" y2="104" stroke="#e2e8f0"/>
  `;
}

function makeSvgFooter(width, height) {
  return `
    <line x1="36" y1="${height - 58}" x2="${width - 36}" y2="${height - 58}" stroke="#e2e8f0"/>
    <text x="44" y="${height - 24}" text-anchor="start" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#94a3b8">Generated with BarData</text>
    <text x="${width - 44}" y="${height - 24}" text-anchor="end" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#ffc200">by tcfella.com</text>
  `;
}

function makeBarcodeSvg(value, options) {
  // Attach to DOM so JsBarcode can fully initialise (detached elements may not render)
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden;";
  document.body.appendChild(container);
  const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  container.appendChild(tempSvg);

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

  const w = Number(tempSvg.getAttribute("width") || 420);
  const h = Number(tempSvg.getAttribute("height") || 180);

  // XMLSerializer gives properly-namespaced output; strip outer <svg> wrapper
  const full = new XMLSerializer().serializeToString(tempSvg);
  const inner = full
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");

  document.body.removeChild(container);
  return { width: w, height: h, inner };
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

function QRCodePreview({ value, size, margin, foreground }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!value) return;
    // Render at a generous resolution so the QR is always crisp.
    // The <img> tag below handles display sizing and always stays square.
    QRCode.toDataURL(value, {
      width: Math.max(320, Number(size) * 1.2),
      margin: Number(margin),
      color: { dark: foreground, light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then(setDataUrl)
      .catch(() => {});
  }, [value, size, margin, foreground]);

  if (!dataUrl) return null;
  // <img> with h-auto always preserves 1:1 aspect ratio — canvas doesn't.
  return (
    <img
      src={dataUrl}
      alt={value}
      className="h-auto w-full max-w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

async function createQRBulkExportCanvas({ bulkItems, foreground, size, margin, columns, showValue }) {
  const exportColumns = Math.max(1, Number(columns));
  const qrSize = Math.max(280, Number(size) * 1.4);
  const labelHeight = showValue ? 36 : 0;
  const qrCanvases = await Promise.all(
    bulkItems.map((item) => createQrCanvas(item, { foreground, size: qrSize, margin, exportScale: 1 }))
  );
  const cellSize = Math.max(360, qrSize + 120);
  const gap = 28;
  const padding = 48;
  const headerHeight = 124;
  const footerHeight = 76;
  const rows = Math.max(1, Math.ceil(bulkItems.length / exportColumns));
  const width = padding * 2 + exportColumns * cellSize + (exportColumns - 1) * gap;
  const cellHeight = cellSize + labelHeight;
  const height = headerHeight + padding + rows * cellHeight + (rows - 1) * gap + footerHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawBrandHeader(ctx, width);
  qrCanvases.forEach((qrCanvas, index) => {
    const col = index % exportColumns;
    const row = Math.floor(index / exportColumns);
    const x = padding + col * (cellSize + gap);
    const y = headerHeight + padding + row * (cellHeight + gap);
    drawCard(ctx, x, y, cellSize, cellHeight);
    const qx = x + (cellSize - qrCanvas.width) / 2;
    const qy = y + (cellSize - qrCanvas.height) / 2 - labelHeight / 2;
    ctx.drawImage(qrCanvas, qx, qy);
    if (showValue) {
      ctx.fillStyle = "#64748b";
      ctx.font = "600 18px Arial, sans-serif";
      ctx.textAlign = "center";
      const maxWidth = cellSize - 32;
      ctx.fillText(bulkItems[index], x + cellSize / 2, y + cellSize - 4, maxWidth);
    }
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
  const [bulkType, setBulkType] = useState("barcode");
  const [value, setValue] = useState("https://tcfella.com");
  const [bulkBarcodeValues, setBulkBarcodeValues] = useState(
    "SKU-1001\nSKU-1002\nSKU-1003\nSKU-1004\nSKU-1005\nSKU-1006"
  );
  const [bulkQrValues, setBulkQrValues] = useState(
    "https://tcfella.com/1\nhttps://tcfella.com/2\nhttps://tcfella.com/3\nhttps://tcfella.com/4\nhttps://tcfella.com/5\nhttps://tcfella.com/6"
  );
  const bulkValues = bulkType === "qr" ? bulkQrValues : bulkBarcodeValues;
  const setBulkValues = bulkType === "qr" ? setBulkQrValues : setBulkBarcodeValues;
  const [barcodeFormat, setBarcodeFormat] = useState("CODE128");
  const [foreground, setForeground] = useState("#111827");
  const [background, setBackground] = useState("transparent");
  const [size, setSize] = useState(220);
  const [margin, setMargin] = useState(3);
  const [columns, setColumns] = useState(3);
  const [showBulkValue, setShowBulkValue] = useState(true);
  const [showQrValue, setShowQrValue] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [bulkErrors, setBulkErrors] = useState([]);
  const [copied, setCopied] = useState(false);

  const barcodeRef = useRef(null);
  const previewRef = useRef(null);
  const bulkSheetRef = useRef(null);
  const previewContainerRef = useRef(null);

  // When preview background is "transparent" the actual barcode/QR still
  // needs a real colour — libraries don't support transparent fills.
  const codeBg = background === "transparent" ? "#ffffff" : background;

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
          light: codeBg,
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
          background: codeBg,
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

  // Scroll behaviour: when mouse is OVER the preview, the preview scrolls;
  // when mouse is NOT over it, wheel events propagate naturally to the page.
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    let over = false;
    const onEnter = () => { over = true; };
    const onLeave = () => { over = false; };

    const onWheel = (e) => {
      if (!over) return; // mouse not over preview — let the page handle it

      const { scrollTop, scrollHeight, clientHeight } = container;
      const canScrollUp   = scrollTop > 0;
      const canScrollDown = scrollTop + clientHeight < scrollHeight - 1;

      if ((e.deltaY < 0 && !canScrollUp) || (e.deltaY > 0 && !canScrollDown)) {
        // Preview is at its scroll limit — let the event bubble to the page
        return;
      }

      // Preview still has room to scroll — consume the event
      e.preventDefault();
      const px =
        e.deltaMode === 1
          ? e.deltaY * 20
          : e.deltaMode === 2
            ? e.deltaY * clientHeight
            : e.deltaY;
      container.scrollTop += px;
    };

    container.addEventListener('mouseenter', onEnter);
    container.addEventListener('mouseleave', onLeave);
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('mouseenter', onEnter);
      container.removeEventListener('mouseleave', onLeave);
      container.removeEventListener('wheel', onWheel);
    };
  }, []);

  const reset = () => {
    setMode("bulk");
    setBulkType("barcode");
    setValue("https://tcfella.com");
    setBulkBarcodeValues("SKU-1001\nSKU-1002\nSKU-1003\nSKU-1004\nSKU-1005\nSKU-1006");
    setBulkQrValues("https://tcfella.com/1\nhttps://tcfella.com/2\nhttps://tcfella.com/3\nhttps://tcfella.com/4\nhttps://tcfella.com/5\nhttps://tcfella.com/6");
    setBarcodeFormat("CODE128");
    setForeground("#111827");
    setBackground("transparent");
    setSize(220);
    setMargin(3);
    setColumns(3);
    setShowBulkValue(true);
    setShowQrValue(false);
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
          ? bulkType === "qr"
            ? await createQRBulkExportCanvas({ bulkItems, foreground, size, margin, columns, showValue: showQrValue })
            : createBulkExportCanvas({ bulkItems, barcodeFormat, foreground, size, margin, columns, showBulkValue })
          : await createSingleExportCanvas({ mode, value, barcodeFormat, foreground, background: codeBg, size, margin });

      downloadDataUrl(
        canvas.toDataURL("image/png"),
        mode === "bulk"
          ? bulkType === "qr" ? "bardata-bulk-qr.png" : "bardata-bulk-barcodes.png"
          : `${fileBase}-bardata.png`
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
            light: codeBg,
          },
          errorCorrectionLevel: "H",
        });

        const viewBoxMatch = qrSvg.match(/viewBox="([^"]+)"/);
        const qrViewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 33 33";
        const qrInner = qrSvg
          .replace(/<\?xml[^>]*\?>\s*/g, "")
          .replace(/<!DOCTYPE[^>]*>\s*/g, "")
          .replace(/<svg[^>]*>/, "")
          .replace(/<\/svg>/, "");

        const width = 900;
        const cardX = 120;
        const cardPad = 30;
        const qrArea = 600;
        const cardY = 144;
        const cardH = qrArea + cardPad * 2;
        const height = cardY + cardH + 76;

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  ${makeSvgBrandHeader(width)}
  <rect x="${cardX}" y="${cardY}" width="660" height="${cardH}" rx="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <svg x="${cardX + cardPad}" y="${cardY + cardPad}" width="${qrArea}" height="${qrArea}" viewBox="${qrViewBox}" xmlns="http://www.w3.org/2000/svg">
    ${qrInner}
  </svg>
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
  <svg x="${bx}" y="${by}" width="${barcode.width}" height="${barcode.height}" viewBox="0 0 ${barcode.width} ${barcode.height}" xmlns="http://www.w3.org/2000/svg">
    ${barcode.inner}
  </svg>
  ${makeSvgFooter(width, height)}
</svg>`;

        downloadText(svg, `${fileBase}-bardata.svg`);
        return;
      }

      const exportColumns = Math.max(1, Number(columns));
      const gap = 28;
      const padding = 48;
      const headerHeight = 124;
      const footerHeight = 76;
      const rows = Math.max(1, Math.ceil(bulkItems.length / exportColumns));

      if (bulkType === "qr") {
        const qrSvgStrings = await Promise.all(
          bulkItems.map((item) =>
            QRCode.toString(item, {
              type: "svg",
              margin: Number(margin),
              color: { dark: foreground, light: "#ffffff" },
              errorCorrectionLevel: "H",
            })
          )
        );
        const labelH = showQrValue ? 36 : 0;
        const cellSize = Math.max(280, Number(size) + 120);
        const cellHeight = cellSize + labelH;
        const width = padding * 2 + exportColumns * cellSize + (exportColumns - 1) * gap;
        const height = headerHeight + padding + rows * cellHeight + (rows - 1) * gap + footerHeight;
        const cells = qrSvgStrings
          .map((qrSvg, index) => {
            const viewBoxMatch = qrSvg.match(/viewBox="([^"]+)"/);
            const qrViewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 200 200";
            const qrInner = qrSvg.replace(/<\?xml[^>]*\?>\s*/g, "").replace(/<!DOCTYPE[^>]*>\s*/g, "").replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");
            const col = index % exportColumns;
            const row = Math.floor(index / exportColumns);
            const x = padding + col * (cellSize + gap);
            const y = headerHeight + padding + row * (cellHeight + gap);
            const innerSize = cellSize - 60;
            const labelEl = showQrValue
              ? `<text x="${x + cellSize / 2}" y="${y + cellSize + 24}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#64748b">${escapeXml(bulkItems[index])}</text>`
              : "";
            return `
              <rect x="${x}" y="${y}" width="${cellSize}" height="${cellHeight}" rx="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
              <svg x="${x + 30}" y="${y + 30}" width="${innerSize}" height="${innerSize}" viewBox="${qrViewBox}" xmlns="http://www.w3.org/2000/svg">
                ${qrInner}
              </svg>
              ${labelEl}`;
          })
          .join("\n");
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  ${makeSvgBrandHeader(width)}
  ${cells}
  ${makeSvgFooter(width, height)}
</svg>`;
        downloadText(svg, "bardata-bulk-qr.svg");
        return;
      }

      const previewBarcode = bulkItems.length
        ? makeBarcodeSvg(bulkItems[0], { format: barcodeFormat, foreground, size, margin, showValue: showBulkValue })
        : null;
      const cellWidth = Math.max(400, (previewBarcode?.width || 400) + 100);
      const cellHeight = Math.max(180, (previewBarcode?.height || 150) + 80);
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
            <svg x="${bx}" y="${by}" width="${barcode.width}" height="${barcode.height}" viewBox="0 0 ${barcode.width} ${barcode.height}" xmlns="http://www.w3.org/2000/svg">
              ${barcode.inner}
            </svg>`;
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

  const downloadBulkPdf = async () => {
    if (mode !== "bulk" || bulkErrors.length) return;

    try {
      const canvas = bulkType === "qr"
        ? await createQRBulkExportCanvas({ bulkItems, foreground, size, margin, columns, showValue: showQrValue })
        : createBulkExportCanvas({ bulkItems, barcodeFormat, foreground, size, margin, columns, showBulkValue });

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
    <main className="soft-texture relative min-h-screen overflow-clip bg-[var(--app-bg)] font-sans text-[var(--app-text)] transition-colors duration-300">
      <style jsx global>{`
        /* ── Design tokens ─────────────────────────────────────────────── */
        :root {
          --app-bg: #f8f8f8;
          --app-surface: #ffffff;
          --app-surface-2: rgba(255, 255, 255, 0.70);
          --app-panel: rgba(255, 255, 255, 0.80);
          --app-text: #1a1100;
          --app-muted: #7a6a48;
          --app-border: rgba(0, 0, 0, 0.10);
          --app-accent: #c49000;
          --app-accent-soft: rgba(196, 144, 0, 0.08);
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --app-bg: #0b0b0b;
            --app-surface: #141414;
            --app-surface-2: #1a1a1a;
            --app-panel: #232323;
            --app-text: #f5f5f3;
            --app-muted: #9a9a96;
            --app-border: rgba(245, 245, 243, 0.10);
            --app-accent: #ffd60a;
            --app-accent-soft: rgba(255, 214, 10, 0.12);
          }
        }

        /* ── Base typography ───────────────────────────────────────────── */
        html {
          background: var(--app-bg);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        body, button, input, textarea, select {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        /* ── Range sliders ─────────────────────────────────────────────── */
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: var(--app-border);
          outline: none;
          cursor: pointer;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--app-accent);
          border: 2.5px solid var(--app-bg);
          box-shadow: 0 1px 6px rgba(0,0,0,0.22);
          cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--app-accent);
          border: 2.5px solid var(--app-bg);
          box-shadow: 0 1px 6px rgba(0,0,0,0.22);
          cursor: pointer;
        }
        input[type="range"]::-moz-range-track {
          height: 6px;
          border-radius: 3px;
          background: var(--app-border);
        }
        input[type="range"]:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px var(--app-accent-soft);
        }

        /* ── Checkboxes ─────────────────────────────────────────────────── */
        input[type="checkbox"] {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          border-radius: 5px;
          border: 1.5px solid var(--app-border);
          background: var(--app-surface);
          cursor: pointer;
          position: relative;
          transition: background 0.15s, border-color 0.15s;
        }
        input[type="checkbox"]:checked {
          background: var(--app-accent);
          border-color: var(--app-accent);
        }
        input[type="checkbox"]:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 6px;
          height: 10px;
          border: 2px solid #0b0b0b;
          border-top: none;
          border-left: none;
          transform: rotate(45deg);
        }

        /* ── Liquid-glass card ─────────────────────────────────────────── */
        /*  Top-left highlight + subtle refraction tint + strong blur      */
        .glass-card {
          background: linear-gradient(
            145deg,
            rgba(255, 255, 255, 0.26) 0%,
            rgba(255, 255, 255, 0.10) 100%
          );
          backdrop-filter: blur(44px) saturate(170%) brightness(1.06);
          -webkit-backdrop-filter: blur(44px) saturate(170%) brightness(1.06);
          border: 1px solid rgba(255, 255, 255, 0.48);
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.72),   /* top specular */
            inset 1px 0   0 rgba(255, 255, 255, 0.22),   /* left edge   */
            inset 0 -1px  0 rgba(0,   0,   0,   0.06),   /* bottom rim  */
            0  4px 16px rgba(15, 23, 42, 0.08),
            0 16px 48px rgba(15, 23, 42, 0.10);
        }

        @media (prefers-color-scheme: dark) {
          .glass-card {
            background: #141414;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            border: 1px solid rgba(245, 245, 243, 0.10);
            box-shadow:
              0  4px 16px rgba(0, 0, 0, 0.40),
              0 20px 60px rgba(0, 0, 0, 0.50);
          }
        }

        /* ── Inner preview glass panel ─────────────────────────────────── */
        .glass-inner {
          background: rgba(255, 255, 255, 0.14);
          backdrop-filter: blur(36px) saturate(160%);
          -webkit-backdrop-filter: blur(36px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.40);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.60),
            inset 0 0 40px rgba(255, 255, 255, 0.05),
            0 2px 12px rgba(15, 23, 42, 0.06);
        }

        @media (prefers-color-scheme: dark) {
          .glass-inner {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.10);
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.14),
              inset 0 0 40px rgba(0, 0, 0, 0.12),
              0 2px 12px rgba(0, 0, 0, 0.30);
          }
        }

        /* ── Gradient-mesh background ──────────────────────────────────── */
        /*  All blobs stay in the cyan → sky → blue → teal brand palette   */
        .soft-texture {
          background-color: var(--app-bg);
          background-image:
            radial-gradient(ellipse 74% 62% at 10% 14%, rgba(255, 194,   0, 0.02), transparent),
            radial-gradient(ellipse 60% 52% at 86% 11%, rgba(245, 158,  11, 0.02), transparent),
            radial-gradient(ellipse 62% 54% at 18% 78%, rgba(234, 179,   8, 0.02), transparent),
            radial-gradient(ellipse 54% 48% at 72% 52%, rgba(253, 224,  71, 0.01), transparent),
            radial-gradient(ellipse 42% 38% at 46% 40%, rgba(255, 194,   0, 0.01), transparent),
            radial-gradient(ellipse 38% 32% at 92% 90%, rgba(217, 119,   6, 0.01), transparent);
        }

        @media (prefers-color-scheme: dark) {
          .soft-texture {
            background-image:
              radial-gradient(ellipse 74% 62% at 10% 14%, rgba(255, 194,   0, 0.04), transparent),
              radial-gradient(ellipse 60% 52% at 86% 11%, rgba(245, 158,  11, 0.03), transparent),
              radial-gradient(ellipse 62% 54% at 18% 78%, rgba(234, 179,   8, 0.03), transparent),
              radial-gradient(ellipse 54% 48% at 72% 52%, rgba(253, 224,  71, 0.02), transparent),
              radial-gradient(ellipse 42% 38% at 46% 40%, rgba(255, 194,   0, 0.02), transparent),
              radial-gradient(ellipse 38% 32% at 92% 90%, rgba(217, 119,   6, 0.02), transparent);
          }
        }

        /* ── Film-grain / noise overlay ────────────────────────────────── */
        /*  Tiny SVG feTurbulence tiled across the whole viewport           */
        .soft-texture::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.038;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 128px 128px;
        }

        @media (prefers-color-scheme: dark) {
          .soft-texture::before { opacity: 0.055; }
        }

        /* ── Bulk grid ─────────────────────────────────────────────────── */
        .bulk-grid { grid-template-columns: 1fr; }

        @media (min-width: 768px) {
          .bulk-grid {
            grid-template-columns: repeat(var(--bulk-columns), minmax(0, 1fr));
          }
        }
      `}</style>

      <section className="relative mx-auto flex min-h-screen w-full max-w-[1800px] flex-col overflow-clip px-4 py-4 sm:px-5 lg:px-7 xl:min-h-0 xl:px-8">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="glass-card relative z-10 mb-4 rounded-[1.5rem] p-4 lg:p-5"
        >
          <nav className="mb-4 flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-sm font-black text-[var(--app-text)]">
              <svg
                width="34"
                height="34"
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
              <span className="flex flex-col leading-tight">
                <span>BarData</span>
                <span className="text-[10px] font-medium opacity-60">by tcfella.com</span>
              </span>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-2 text-xs font-bold text-[var(--app-muted)] sm:flex">
              <span className="h-2 w-2 rounded-full bg-[var(--app-accent)]" />
              Client-side · free · no sign-up
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
            <Card className="glass-card h-auto overflow-hidden rounded-[2rem]">
              <CardContent className="h-auto p-4 md:p-5 xl:p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 rounded-[1.5rem] border border-[var(--app-border)] bg-[var(--app-surface-2)]/70 p-1.5 backdrop-blur-xl sm:p-2">
                    <button
                      onClick={() => setMode("qr")}
                      className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold transition sm:px-3 sm:text-sm ${
                        mode === "qr"
                          ? "bg-[var(--app-accent-soft)] text-[var(--app-text)] shadow-sm ring-1 ring-[var(--app-accent)]/40"
                          : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                      }`}
                    >
                      <QrCode size={18} /> QR
                    </button>

                    <button
                      onClick={() => setMode("barcode")}
                      className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold transition sm:px-3 sm:text-sm ${
                        mode === "barcode"
                          ? "bg-[var(--app-accent-soft)] text-[var(--app-text)] shadow-sm ring-1 ring-[var(--app-accent)]/40"
                          : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                      }`}
                    >
                      <Barcode size={18} /> Single
                    </button>

                    <button
                      onClick={() => setMode("bulk")}
                      className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold transition sm:px-3 sm:text-sm ${
                        mode === "bulk"
                          ? "bg-[var(--app-accent-soft)] text-[var(--app-text)] shadow-sm ring-1 ring-[var(--app-accent)]/40"
                          : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                      }`}
                    >
                      <Layers size={18} /> Bulk
                    </button>
                  </div>

                  {mode === "bulk" && (
                    <div className="grid grid-cols-2 gap-2 rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface-2)]/70 p-1.5 backdrop-blur-xl">
                      <button
                        onClick={() => setBulkType("barcode")}
                        className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                          bulkType === "barcode"
                            ? "bg-[var(--app-accent-soft)] text-[var(--app-text)] shadow-sm ring-1 ring-[var(--app-accent)]/40"
                            : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                        }`}
                      >
                        <Barcode size={15} /> Barcode
                      </button>
                      <button
                        onClick={() => setBulkType("qr")}
                        className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                          bulkType === "qr"
                            ? "bg-[var(--app-accent-soft)] text-[var(--app-text)] shadow-sm ring-1 ring-[var(--app-accent)]/40"
                            : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                        }`}
                      >
                        <QrCode size={15} /> QR Code
                      </button>
                    </div>
                  )}

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

                  {(mode === "barcode" || (mode === "bulk" && bulkType === "barcode")) && (
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
                          {bulkType === "qr" ? "Bulk QR values" : "Bulk barcode values"}
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
                          bulkType === "qr"
                            ? "Paste one value per line.\nhttps://example.com\nmailto:hello@example.com\nHello, World!"
                            : "Paste one barcode value per line.\nSKU-1001\nSKU-1002\nSKU-1003"
                        }
                        className="w-full resize-none rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)]"
                      />
                      <p className="text-xs leading-5 text-[var(--app-muted)]">
                        {bulkType === "qr"
                          ? "QR codes support URLs, plain text, email, phone, Wi-Fi strings, and more."
                          : "For mixed letters/numbers, use CODE128. EAN-13, UPC, and ITF-14 require specific digit lengths."}
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
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-[var(--app-text)]">
                          Background
                        </label>
                        <button
                          onClick={() =>
                            setBackground(
                              background === "transparent" ? "#ffffff" : "transparent"
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                            background === "transparent"
                              ? "bg-[var(--app-accent-soft)] text-[var(--app-text)] ring-1 ring-[var(--app-accent)]/40"
                              : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                          }`}
                        >
                          {/* checkerboard icon */}
                          <span
                            className="inline-block h-3 w-3 rounded-sm border border-current/20"
                            style={{
                              backgroundImage:
                                "linear-gradient(45deg,#aaa 25%,transparent 25%),linear-gradient(-45deg,#aaa 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#aaa 75%),linear-gradient(-45deg,transparent 75%,#aaa 75%)",
                              backgroundSize: "6px 6px",
                              backgroundPosition: "0 0,0 3px,3px -3px,-3px 0",
                            }}
                          />
                          None
                        </button>
                      </div>
                      {background !== "transparent" && (
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
                      )}
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
                        style={{ background: `linear-gradient(to right, var(--app-accent) ${((size-220)/(620-220)*100).toFixed(1)}%, var(--app-border) ${((size-220)/(620-220)*100).toFixed(1)}%)` }}
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
                        style={{ background: `linear-gradient(to right, var(--app-accent) ${(margin/8*100).toFixed(1)}%, var(--app-border) ${(margin/8*100).toFixed(1)}%)` }}
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
                          style={{ background: `linear-gradient(to right, var(--app-accent) ${((columns-1)/(5-1)*100).toFixed(1)}%, var(--app-border) ${((columns-1)/(5-1)*100).toFixed(1)}%)` }}
                        />
                      </div>

                      {bulkType === "barcode" && (
                        <label className="flex items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm font-medium text-[var(--app-text)]">
                          <input
                            type="checkbox"
                            checked={showBulkValue}
                            onChange={(e) => setShowBulkValue(e.target.checked)}
                            className=""
                          />
                          Show value below barcode
                        </label>
                      )}
                      {bulkType === "qr" && (
                        <label className="flex items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm font-medium text-[var(--app-text)]">
                          <input
                            type="checkbox"
                            checked={showQrValue}
                            onChange={(e) => setShowQrValue(e.target.checked)}
                            className=""
                          />
                          Show value below QR code
                        </label>
                      )}
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
                      className="rounded-2xl bg-[var(--app-accent-soft)] px-4 font-bold text-[var(--app-text)] ring-1 ring-[var(--app-accent)]/40 hover:bg-[var(--app-accent)]/20"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {mode === "bulk" ? (bulkType === "qr" ? "Sheet PNG" : "Sheet PNG") : "PNG"}
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
            className="min-h-0 min-w-0 xl:flex xl:flex-col xl:self-stretch"
          >
            <Card className="glass-card h-auto overflow-hidden rounded-[2rem] xl:flex xl:h-full xl:flex-col">
              <CardContent className="flex h-auto flex-col gap-4 p-4 md:p-5 xl:flex-1 xl:p-6">
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
                      ? `${bulkItems.length} bulk ${bulkType === "qr" ? "QR codes" : "barcodes"}`
                      : mode === "qr"
                        ? "QR export"
                        : `${barcodeFormat} export`}
                  </div>
                </div>

                <div
                  ref={previewContainerRef}
                  className="glass-inner min-h-[560px] flex-1 overflow-x-hidden overflow-y-auto rounded-[2rem] p-3 md:min-h-[680px] md:p-5 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:p-7"
                >
                  {mode !== "bulk" ? (
                    <div
                      ref={previewRef}
                      className="flex min-h-[520px] w-full items-center justify-center rounded-[1.65rem] p-6 shadow-sm md:min-h-[680px] md:p-8 xl:min-h-0 xl:flex-1"
                      style={{ backgroundColor: background }}
                    >
                      {mode === "qr" ? (
                        qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="Generated QR code"
                            className="h-auto w-full max-w-[min(480px,90%)] xl:max-h-[70vh] xl:w-auto xl:max-w-[min(480px,90%)]"
                          />
                        ) : (
                          <div className="text-center text-slate-500">
                            QR preview will appear here
                          </div>
                        )
                      ) : (
                        <div className="w-full max-w-[680px]">
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
                            bulkType === "qr" ? (
                              <div
                                key={`${item}-${index}`}
                                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3"
                              >
                                {/* wrapper keeps the QR square regardless of container width */}
                                <div className="aspect-square w-full">
                                  <QRCodePreview
                                    value={item}
                                    size={size}
                                    margin={margin}
                                    foreground={foreground}
                                  />
                                </div>
                                {showQrValue && (
                                  <p className="w-full truncate text-center text-[11px] font-semibold text-slate-500">
                                    {item}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div
                                key={`${item}-${index}`}
                                className="flex flex-col items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3"
                                style={{ minHeight: Math.max(110, size * 0.42) + 36 + "px" }}
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
                            )
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

      <footer className="relative z-10 w-full border-t border-[var(--app-border)] bg-[var(--app-panel)] backdrop-blur-3xl">
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 585.61 501.84" className="h-4 w-4 shrink-0" aria-hidden="true">
                <path fill="currentColor" d="M585.13,0v501.84s-83.04,0-83.04,0l-.18-250.85-83.5.03v-83.75s83.5.04,83.5.04l-.02-83.62h-250.79s-.03,83.61-.03,83.61h-83.66s-.01-83.61-.01-83.61H.5c-.78-1.29-.03-2.26-.02-3.56L.49,0h584.64Z"/>
                <polygon fill="#ffc200" points="84.01 501.84 0 501.84 .11 418.28 83.83 418.28 84.01 501.84"/>
                <polygon fill="#ffc200" points="251.08 167.29 418.41 167.26 418.41 251.01 251.22 251.01 251.18 418.25 418.29 418.28 418.57 501.84 167.53 501.84 167.42 167.29 251.08 167.29"/>
                <rect fill="#ffc200" x="585.13" y="0" width=".48" height="501.84"/>
              </svg>
            by tcfella.com
          </a>
        </div>
      </footer>
    </main>
  );
}
