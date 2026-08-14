"use client";

/* QR previews intentionally use raw data-URL images to preserve crisp pixels. */
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  QrCode,
  Barcode,
  RotateCcw,
  Copy,
  Check,
  Layers,
  FileText,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

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

const qrExampleValue = "https://tcfella.com";

const bulkQrExamples = [
  "https://tcfella.com/1",
  "https://tcfella.com/2",
  "https://tcfella.com/3",
  "https://tcfella.com/4",
  "https://tcfella.com/5",
  "https://tcfella.com/6",
];

const barcodeExamples = {
  CODE128: ["SKU-1001", "SKU-1002", "SKU-1003", "SKU-1004", "SKU-1005", "SKU-1006"],
  EAN13: ["590123412345", "400638133393", "123456789012", "978020137962"],
  UPC: ["03600029145", "04210000526", "01234567890", "72527273070"],
  CODE39: ["ABC-123", "PART-204", "BIN-305", "BOX-406"],
  ITF14: ["10012345678902", "10012345678919", "10012345678926", "10012345678933"],
  MSI: ["1234567890", "2345678901", "3456789012", "4567890123"],
};

const defaultSizes = {
  qr: 320,
  barcode: 220,
  bulk: 220,
};

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadText(text, fileName, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Keep the Blob URL alive long enough for Safari and mobile browsers to
  // finish reading it after the click handler returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function downloadSvgFile(svgText, fileName) {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const parserError = parsed.querySelector("parsererror");
  const root = parsed.documentElement;

  if (
    parserError ||
    root.localName !== "svg" ||
    root.namespaceURI !== "http://www.w3.org/2000/svg"
  ) {
    throw new Error("Generated SVG is not a valid SVG document.");
  }

  const serialized = new XMLSerializer().serializeToString(root);
  downloadText(
    `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`,
    fileName,
    "image/svg+xml;charset=utf-8"
  );
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

  // JsBarcode writes dimensions with CSS units (for example, "307px").
  // Number("307px") is NaN, which breaks positioning in composed SVG sheets.
  const parsedWidth = Number.parseFloat(tempSvg.getAttribute("width") || "");
  const parsedHeight = Number.parseFloat(tempSvg.getAttribute("height") || "");
  const w = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 420;
  const h = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 180;

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

function normalizeHexColor(input) {
  const value = input.trim();

  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [red, green, blue] = value.slice(1);
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }

  return null;
}

function hexToHsv(input) {
  const hex = normalizeHexColor(input) || "#000000";
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: maximum === 0 ? 0 : delta / maximum,
    v: maximum,
  };
}

function hsvToHex(hue, saturation, value) {
  const chroma = value * saturation;
  const section = ((hue % 360) + 360) % 360 / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const offset = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (section < 1) [red, green] = [chroma, secondary];
  else if (section < 2) [red, green] = [secondary, chroma];
  else if (section < 3) [green, blue] = [chroma, secondary];
  else if (section < 4) [green, blue] = [secondary, chroma];
  else if (section < 5) [red, blue] = [secondary, chroma];
  else [red, blue] = [chroma, secondary];

  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + offset) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

function ColorControl({ label, value, onChange }) {
  const [draft, setDraft] = useState(value.toUpperCase());
  const [isInvalid, setIsInvalid] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [hue, setHue] = useState(() => hexToHsv(value).h);
  const hsv = hexToHsv(value);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setDraft(value.toUpperCase());
      setIsInvalid(false);
      const nextHsv = hexToHsv(value);
      if (nextHsv.s > 0) setHue(nextHsv.h);
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  const applyColor = (nextColor) => {
    const normalized = normalizeHexColor(nextColor);
    if (!normalized) return false;

    setDraft(normalized.toUpperCase());
    setIsInvalid(false);
    const nextHsv = hexToHsv(normalized);
    if (nextHsv.s > 0) setHue(nextHsv.h);
    onChange(normalized);
    return true;
  };

  const handleHexChange = (event) => {
    const nextDraft = event.currentTarget.value;
    setDraft(nextDraft);
    setIsInvalid(false);

    // Keep the preview live as soon as the typed value is a complete color,
    // without sending incomplete/invalid values to the code generators.
    const normalized = normalizeHexColor(nextDraft);
    if (normalized) applyColor(normalized);
  };

  const commitHexValue = () => {
    if (!applyColor(draft)) {
      setDraft(value.toUpperCase());
      setIsInvalid(true);
    }
  };

  const updateSaturationAndValue = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const saturation = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width)
    );
    const brightness = Math.min(
      1,
      Math.max(0, 1 - (event.clientY - bounds.top) / bounds.height)
    );
    applyColor(hsvToHex(hue, saturation, brightness));
  };

  const handlePalettePointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSaturationAndValue(event);
  };

  const handlePalettePointerMove = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      updateSaturationAndValue(event);
    }
  };

  const handleHueChange = (event) => {
    const nextHue = Number(event.currentTarget.value);
    setHue(nextHue);
    applyColor(hsvToHex(nextHue, hsv.s, hsv.v));
  };

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsPaletteOpen((current) => !current)}
          aria-label={`Open ${label.toLowerCase()} color palette`}
          aria-expanded={isPaletteOpen}
          className="relative h-11 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-[var(--app-border)] p-1 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
          style={{ backgroundColor: value }}
        >
          <span className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/10" />
          <Palette className="absolute bottom-1 right-1 size-3.5 rounded bg-white/85 p-0.5 text-slate-800 shadow-sm" />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            value={draft}
            aria-label={`${label} hex color`}
            aria-invalid={isInvalid}
            maxLength={7}
            spellCheck={false}
            onChange={handleHexChange}
            onBlur={commitHexValue}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitHexValue();
                event.currentTarget.blur();
              }
            }}
            className={`h-11 w-full rounded-2xl border bg-[var(--app-surface)] py-2.5 pl-4 pr-11 uppercase text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] ${
              isInvalid ? "border-red-500" : "border-[var(--app-border)]"
            }`}
          />
          <button
            type="button"
            onClick={() => setIsPaletteOpen((current) => !current)}
            aria-label={`Open ${label.toLowerCase()} color palette`}
            aria-expanded={isPaletteOpen}
            title="Open color palette"
            className={`absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] ${
              isPaletteOpen
                ? "bg-[var(--app-accent-soft)] text-[var(--app-text)]"
                : "text-[var(--app-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
            }`}
          >
            <Palette className="size-4" />
          </button>
        </div>
      </div>

      {isPaletteOpen && (
        <div className="mt-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-sm">
          <div
            role="group"
            aria-label={`${label} saturation and brightness`}
            className="relative h-28 w-full touch-none cursor-crosshair overflow-hidden rounded-xl"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hue} 100% 50%)`,
            }}
            onPointerDown={handlePalettePointerDown}
            onPointerMove={handlePalettePointerMove}
          >
            <span
              className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.65),0_1px_4px_rgba(15,23,42,0.45)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
              Hue
            </span>
            <input
              type="range"
              min="0"
              max="359"
              value={Math.round(hue)}
              aria-label={`${label} hue`}
              onInput={handleHueChange}
              onChange={handleHueChange}
              className="h-3 min-w-0 flex-1 cursor-pointer appearance-none rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function BarcodeQrGeneratorApp() {
  const [mode, setMode] = useState("bulk");
  const [bulkType, setBulkType] = useState("barcode");
  const [value, setValue] = useState("");
  const [bulkBarcodeValues, setBulkBarcodeValues] = useState("");
  const [bulkQrValues, setBulkQrValues] = useState("");
  const bulkValues = bulkType === "qr" ? bulkQrValues : bulkBarcodeValues;
  const setBulkValues = bulkType === "qr" ? setBulkQrValues : setBulkBarcodeValues;
  const [barcodeFormat, setBarcodeFormat] = useState("CODE128");
  const [foreground, setForeground] = useState("#111827");
  const [background, setBackground] = useState("transparent");
  const [sizes, setSizes] = useState(defaultSizes);
  const [margin, setMargin] = useState(3);
  const [columns, setColumns] = useState(2);
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

  const size = sizes[mode];
  const setSize = (nextSize) => {
    setSizes((currentSizes) => ({
      ...currentSizes,
      [mode]: nextSize,
    }));
  };

  // When preview background is "transparent" the actual barcode/QR still
  // needs a real colour — libraries don't support transparent fills.
  const codeBg = background === "transparent" ? "#ffffff" : background;

  const singleExampleValue =
    mode === "qr" ? qrExampleValue : barcodeExamples[barcodeFormat][0];
  const effectiveValue = value.trim() || singleExampleValue;
  const enteredBulkItems = useMemo(() => getBulkItems(bulkValues), [bulkValues]);
  const exampleBulkItems =
    bulkType === "qr" ? bulkQrExamples : barcodeExamples[barcodeFormat];
  const usingBulkExamples = enteredBulkItems.length === 0;
  const bulkItems = usingBulkExamples ? exampleBulkItems : enteredBulkItems;
  const bulkPlaceholder = exampleBulkItems.join("\n");
  const fileBase = useMemo(
    () => safeFileName(`${mode}-${effectiveValue}`),
    [mode, effectiveValue]
  );

  useEffect(() => {
    let cancelled = false;
    const updateError = (message) => {
      queueMicrotask(() => {
        if (!cancelled) setError(message);
      });
    };

    updateError("");

    if (mode === "bulk") {
      return () => {
        cancelled = true;
      };
    }

    if (mode === "qr") {
      QRCode.toDataURL(effectiveValue, {
        width: Number(size),
        margin: Number(margin),
        color: {
          dark: foreground,
          light: codeBg,
        },
        errorCorrectionLevel: "H",
      })
        .then((dataUrl) => {
          if (!cancelled) setQrDataUrl(dataUrl);
        })
        .catch(() => updateError("Could not generate this QR code."));
    }

    if (mode === "barcode" && barcodeRef.current) {
      try {
        barcodeRef.current.innerHTML = "";

        JsBarcode(barcodeRef.current, effectiveValue, {
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
        updateError(
          barcodeFormat === "EAN13"
            ? "EAN-13 needs exactly 12 or 13 digits. Example: 5901234123457"
            : barcodeFormat === "UPC"
              ? "UPC-A needs exactly 11 or 12 digits. Example: 123456789012"
              : "This value is not valid for the selected barcode format. Try CODE128 for general text."
        );
      }
    }

    return () => {
      cancelled = true;
    };
  }, [mode, effectiveValue, barcodeFormat, foreground, codeBg, size, margin]);

  useEffect(() => {
    if (mode !== "bulk") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setBulkErrors([]);
    });

    return () => {
      cancelled = true;
    };
  }, [mode, bulkValues, barcodeFormat, bulkType]);

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
    setValue("");
    setBulkBarcodeValues("");
    setBulkQrValues("");
    setBarcodeFormat("CODE128");
    setForeground("#111827");
    setBackground("transparent");
    setSizes({ ...defaultSizes });
    setMargin(3);
    setColumns(2);
    setShowBulkValue(true);
    setShowQrValue(false);
    setError("");
    setBulkErrors([]);
  };

  const copyValue = async () => {
    await navigator.clipboard.writeText(
      mode === "bulk" ? bulkItems.join("\n") : effectiveValue
    );
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
          : await createSingleExportCanvas({ mode, value: effectiveValue, barcodeFormat, foreground, background: codeBg, size, margin });

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
        const qrSvg = await QRCode.toString(effectiveValue, {
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

        downloadSvgFile(svg, `${fileBase}-bardata.svg`);
        return;
      }

      if (mode === "barcode") {
        const barcode = makeBarcodeSvg(effectiveValue, {
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

        downloadSvgFile(svg, `${fileBase}-bardata.svg`);
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
        downloadSvgFile(svg, "bardata-bulk-qr.svg");
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

      downloadSvgFile(svg, "bardata-bulk-barcodes.svg");
    } catch (err) {
      console.error("SVG export failed:", err);
      setError("Could not export SVG. Check the barcode value and format.");
    }
  };

  const downloadBulkPdf = async () => {
    if (mode !== "bulk" || bulkErrors.length) return;

    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidthMm = pdf.internal.pageSize.getWidth();
      const pageHeightMm = pdf.internal.pageSize.getHeight();
      const marginMm = 6;
      const usableWidthMm = pageWidthMm - marginMm * 2;
      const usableHeightMm = pageHeightMm - marginMm * 2;
      const exportColumns = Math.max(1, Number(columns));
      const gap = 28;
      const padding = 48;
      const headerHeight = 124;
      const footerHeight = 76;

      let exportCanvasWidth;
      let exportCellHeight;

      if (bulkType === "qr") {
        const qrSize = Math.max(280, Number(size) * 1.4);
        const cellSize = Math.max(360, qrSize + 120);
        const labelHeight = showQrValue ? 36 : 0;
        exportCellHeight = cellSize + labelHeight;
        exportCanvasWidth =
          padding * 2 +
          exportColumns * cellSize +
          (exportColumns - 1) * gap;
      } else {
        const previewBarcode = createBarcodeCanvas(bulkItems[0], {
          format: barcodeFormat,
          foreground,
          size,
          margin,
          showValue: showBulkValue,
          exportScale: 1.8,
        });
        const cellWidth = Math.max(620, previewBarcode.width + 130);
        exportCellHeight = Math.max(280, previewBarcode.height + 130);
        exportCanvasWidth =
          padding * 2 +
          exportColumns * cellWidth +
          (exportColumns - 1) * gap;
      }

      // Calculate how many complete rows fit on A4. Pages are then rendered
      // independently so a page boundary can never cut through a code.
      const maxCanvasHeight =
        exportCanvasWidth * (usableHeightMm / usableWidthMm);
      const fixedCanvasHeight = headerHeight + padding + footerHeight;
      const rowsPerPage = Math.max(
        1,
        Math.floor(
          (maxCanvasHeight - fixedCanvasHeight + gap) /
            (exportCellHeight + gap)
        )
      );
      const itemsPerPage = rowsPerPage * exportColumns;

      for (let offset = 0; offset < bulkItems.length; offset += itemsPerPage) {
        const pageItems = bulkItems.slice(offset, offset + itemsPerPage);
        const pageCanvas =
          bulkType === "qr"
            ? await createQRBulkExportCanvas({
                bulkItems: pageItems,
                foreground,
                size,
                margin,
                columns,
                showValue: showQrValue,
              })
            : createBulkExportCanvas({
                bulkItems: pageItems,
                barcodeFormat,
                foreground,
                size,
                margin,
                columns,
                showBulkValue,
              });

        if (offset > 0) pdf.addPage();

        const scale = Math.min(
          usableWidthMm / pageCanvas.width,
          usableHeightMm / pageCanvas.height
        );
        const renderedWidthMm = pageCanvas.width * scale;
        const renderedHeightMm = pageCanvas.height * scale;
        const x = (pageWidthMm - renderedWidthMm) / 2;

        pdf.addImage(
          pageCanvas.toDataURL("image/png"),
          "PNG",
          x,
          marginMm,
          renderedWidthMm,
          renderedHeightMm
        );
      }

      pdf.save(
        bulkType === "qr"
          ? "bardata-bulk-qr.pdf"
          : "bardata-bulk-barcodes.pdf"
      );
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
    <main className="soft-texture relative h-[100dvh] overflow-hidden bg-[var(--app-bg)] font-sans text-[var(--app-text)] transition-colors duration-300">
      <style jsx global>{`
        /* ── Design tokens ─────────────────────────────────────────────── */
        :root {
          --app-bg: #eeeeeb;
          --app-surface: #fbfaf6;
          --app-surface-2: #f1efe8;
          --app-panel: #fbfaf6;
          --app-text: #171713;
          --app-muted: #747168;
          --app-border: #d5d1c5;
          --app-accent: #f5c800;
          --app-accent-soft: rgba(245, 200, 0, 0.16);
          --preview-grid: rgba(23, 23, 19, 0.025);
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --app-bg: #0d0d0c;
            --app-surface: #161614;
            --app-surface-2: #1e1e1b;
            --app-panel: #161614;
            --app-text: #f4f2eb;
            --app-muted: #98958a;
            --app-border: #32312c;
            --app-accent: #ffd60a;
            --app-accent-soft: rgba(255, 214, 10, 0.16);
            --preview-grid: rgba(255, 255, 255, 0.02);
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

        .glass-card {
          background: var(--app-surface);
          border: 1px solid var(--app-border);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.6) inset,
            0 8px 24px rgba(32, 29, 18, 0.07);
        }

        @media (prefers-color-scheme: dark) {
          .glass-card {
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
          }
        }

        .glass-inner {
          background-color: var(--app-surface-2);
          background-image:
            linear-gradient(var(--preview-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--preview-grid) 1px, transparent 1px);
          background-size: 22px 22px;
          border: 1px solid var(--app-border);
        }

        .soft-texture {
          background-color: var(--app-bg);
          background-image:
            radial-gradient(circle at 12% 0%, rgba(245, 200, 0, 0.025), transparent 28%),
            linear-gradient(rgba(23, 23, 19, 0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(23, 23, 19, 0.018) 1px, transparent 1px);
          background-size: auto, 32px 32px, 32px 32px;
        }

        @media (prefers-color-scheme: dark) {
          .soft-texture {
            background-image:
              radial-gradient(circle at 12% 0%, rgba(255, 214, 10, 0.03), transparent 28%),
              linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
            background-size: auto, 32px 32px, 32px 32px;
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

        .settings-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--app-border) transparent;
        }

        .data-dock textarea {
          min-height: 82px;
          max-height: 104px;
        }

        .bulk-grid {
          grid-template-columns: repeat(var(--bulk-columns), minmax(0, 1fr));
        }

        @media (max-height: 700px) and (max-width: 1023px) {
          .data-dock {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .data-dock > :first-child,
          .data-dock > :last-child {
            grid-column: 1 / -1;
          }

          .data-dock textarea {
            min-height: 68px;
            max-height: 68px;
          }
        }
      `}</style>

      <section className="relative mx-auto flex h-[100dvh] w-full max-w-[1920px] flex-col overflow-hidden p-2 sm:p-3 lg:p-4">
        <header className="glass-card relative z-10 mb-2 flex h-14 shrink-0 items-center justify-between rounded-2xl px-3 sm:mb-3 sm:h-16 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#11110f] text-white ring-1 ring-black/10 dark:bg-[#ffd60a] dark:text-[#11110f]">
              <svg
                width="26"
                height="26"
                viewBox="0 0 32 32"
                fill="none"
                aria-hidden="true"
              >
                <rect x="3" y="6" width="3" height="20" rx="1" fill="currentColor" />
                <rect x="8" y="6" width="1.8" height="20" rx="0.9" fill="currentColor" />
                <rect x="12" y="6" width="4" height="20" rx="1" fill="currentColor" />
                <rect x="18" y="6" width="2" height="20" rx="1" fill="currentColor" />
                <rect x="23" y="6" width="6" height="20" rx="1" fill="var(--app-accent)" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="flex items-baseline gap-2">
                <span className="text-base font-black tracking-[-0.03em] sm:text-lg">BarData</span>
                <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)] sm:inline">
                  Free QR &amp; barcode generator
                </span>
              </h1>
              <p className="truncate text-[10px] font-medium text-[var(--app-muted)] sm:text-xs">
                Your data stays in this browser
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-1.5 text-[11px] font-bold text-[var(--app-muted)] md:flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Ready to export
            </div>
            <a
              href="https://tcfella.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
            >
              tcfella.com
            </a>
          </div>
        </header>

        <div className="relative z-10 grid min-h-0 flex-1 grid-rows-[minmax(250px,1.05fr)_minmax(180px,0.95fr)] gap-2 sm:gap-3 lg:grid-cols-[minmax(360px,0.72fr)_minmax(0,1.28fr)] lg:grid-rows-[minmax(0,1fr)]">
          <div className="min-h-0 min-w-0">
            <Card className="glass-card h-full overflow-hidden rounded-2xl py-0 sm:rounded-3xl">
              <CardContent className="flex h-full min-h-0 flex-col p-3 sm:p-4 lg:p-5">
                <div className="flex h-full min-h-0 flex-col gap-3">
                  <div className="data-dock shrink-0 space-y-3">
                  <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-1">
                    <button
                      onClick={() => setMode("qr")}
                      className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold transition sm:px-3 sm:text-sm ${
                        mode === "qr"
                          ? "bg-[var(--app-accent)] text-[#17150d] shadow-sm"
                          : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                      }`}
                    >
                      <QrCode size={18} /> QR
                    </button>

                    <button
                      onClick={() => setMode("barcode")}
                      className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold transition sm:px-3 sm:text-sm ${
                        mode === "barcode"
                          ? "bg-[var(--app-accent)] text-[#17150d] shadow-sm"
                          : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                      }`}
                    >
                      <Barcode size={18} /> Single
                    </button>

                    <button
                      onClick={() => setMode("bulk")}
                      className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold transition sm:px-3 sm:text-sm ${
                        mode === "bulk"
                          ? "bg-[var(--app-accent)] text-[#17150d] shadow-sm"
                          : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                      }`}
                    >
                      <Layers size={18} /> Bulk
                    </button>
                  </div>

                  {mode === "bulk" && (
                    <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-1">
                      <button
                        onClick={() => setBulkType("barcode")}
                        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          bulkType === "barcode"
                          ? "bg-[var(--app-accent)] text-[#17150d] shadow-sm"
                            : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                        }`}
                      >
                        <Barcode size={15} /> Barcode
                      </button>
                      <button
                        onClick={() => setBulkType("qr")}
                        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          bulkType === "qr"
                          ? "bg-[var(--app-accent)] text-[#17150d] shadow-sm"
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
                        className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
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
                        className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
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
                        placeholder={singleExampleValue}
                        className="w-full resize-none rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-xs leading-5 text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)]"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-bold text-[var(--app-text)]">
                          {bulkType === "qr" ? "Bulk QR values" : "Bulk barcode values"}
                        </label>
                        <span className="text-xs font-medium text-[var(--app-muted)]">
                          {usingBulkExamples
                            ? `${bulkItems.length} examples`
                            : `${bulkItems.length} item${bulkItems.length === 1 ? "" : "s"}`}
                        </span>
                      </div>
                      <textarea
                        value={bulkValues}
                        onChange={(e) => setBulkValues(e.target.value)}
                        rows={6}
                        placeholder={bulkPlaceholder}
                        className="w-full resize-none rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-xs leading-5 text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)]"
                      />
                      <p className="hidden text-xs leading-5 text-[var(--app-muted)] lg:block">
                        {bulkType === "qr"
                          ? "QR codes support URLs, plain text, email, phone, Wi-Fi strings, and more."
                          : "For mixed letters/numbers, use CODE128. EAN-13, UPC, and ITF-14 require specific digit lengths."}
                      </p>
                    </div>
                  )}
                  </div>

                  <div className="settings-scroll min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--app-text)]">
                          Customize
                        </p>
                        <p className="text-[10px] text-[var(--app-muted)]">
                          Color, size, spacing, and sheet options
                        </p>
                      </div>
                      <button
                        onClick={reset}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
                      >
                        <RotateCcw className="size-3.5" />
                        Reset
                      </button>
                    </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[var(--app-text)]">
                        Foreground
                      </label>
                      <ColorControl
                        label="Foreground"
                        value={foreground}
                        onChange={setForeground}
                      />
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
                        <ColorControl
                          label="Background"
                          value={background}
                          onChange={setBackground}
                        />
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

                  <section
                    aria-labelledby="about-bardata"
                    className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-[11px] leading-5 text-[var(--app-muted)]"
                  >
                    <h2
                      id="about-bardata"
                      className="text-xs font-black text-[var(--app-text)]"
                    >
                      Free online QR code and barcode generator
                    </h2>
                    <p className="mt-1">
                      Create single codes or bulk printable sheets directly in
                      your browser. Customize size, margin, foreground, and
                      background, then download PNG, SVG, or print-ready PDF
                      files without an account.
                    </p>

                    <details className="mt-2 border-t border-[var(--app-border)] pt-2">
                      <summary className="cursor-pointer font-bold text-[var(--app-text)]">
                        How to generate codes
                      </summary>
                      <p className="mt-1">
                        Choose QR, Single, or Bulk. Enter one value for a single
                        code, or put one value on each line for a bulk sheet.
                        The live preview updates as you type, and exports use
                        the same values and settings shown on screen.
                      </p>
                    </details>

                    <details className="mt-2 border-t border-[var(--app-border)] pt-2">
                      <summary className="cursor-pointer font-bold text-[var(--app-text)]">
                        Supported barcode formats
                      </summary>
                      <p className="mt-1">
                        Use Code 128 for general text, SKUs, inventory, and
                        shipping labels. BarData also supports EAN-13, UPC-A,
                        Code 39, ITF-14, and MSI for retail, warehouse, and
                        packaging workflows.
                      </p>
                    </details>

                    <details className="mt-2 border-t border-[var(--app-border)] pt-2">
                      <summary className="cursor-pointer font-bold text-[var(--app-text)]">
                        Private by design
                      </summary>
                      <p className="mt-1">
                        Code generation happens locally in your browser. The
                        values you enter are not uploaded to a BarData server.
                        The project is available on{` `}
                        <a
                          href="https://github.com/heroutbs99/bardata"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-[var(--app-text)] underline underline-offset-2"
                        >
                          GitHub
                        </a>
                        .
                      </p>
                    </details>
                  </section>

                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="min-h-0 min-w-0">
            <Card className="glass-card flex h-full flex-col overflow-hidden rounded-2xl py-0 sm:rounded-3xl">
              <CardContent className="flex h-full min-h-0 flex-col gap-2 p-3 sm:gap-3 sm:p-4 lg:p-5">
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full bg-[var(--app-accent)] shadow-[0_0_0_4px_var(--app-accent-soft)]" />
                      <h2 className="text-sm font-black tracking-[-0.02em] text-[var(--app-text)] sm:text-base">
                        Live preview
                      </h2>
                      <span className="hidden truncate text-[11px] font-semibold text-[var(--app-muted)] sm:inline">
                        {mode === "bulk"
                          ? `${bulkItems.length} ${bulkType === "qr" ? "QR codes" : "barcodes"} · ${columns} columns${usingBulkExamples ? " · examples" : ""}`
                          : mode === "qr"
                            ? `QR code${value.trim() ? "" : " · example"}`
                            : `${barcodeFormat}${value.trim() ? "" : " · example"}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      onClick={downloadPng}
                      size="sm"
                      className="h-8 rounded-lg bg-[var(--app-accent)] px-2.5 text-xs font-black text-[#17150d] hover:bg-[var(--app-accent)]/80"
                    >
                      <Download className="size-3.5" />
                      PNG
                    </Button>
                    <Button
                      onClick={downloadSvg}
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs font-black text-[var(--app-text)]"
                    >
                      SVG
                    </Button>
                    {mode === "bulk" && (
                      <Button
                        onClick={downloadBulkPdf}
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs font-black text-[var(--app-text)]"
                      >
                        <FileText className="size-3.5" />
                        PDF
                      </Button>
                    )}
                  </div>
                </div>

                <div
                  ref={previewContainerRef}
                  className="glass-inner flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto rounded-xl p-2 sm:rounded-2xl sm:p-3 lg:p-4"
                >
                  {mode !== "bulk" ? (
                    <div
                      ref={previewRef}
                      className={`flex min-h-0 w-full flex-1 items-center justify-center rounded-lg p-3 sm:rounded-xl sm:p-5 ${
                        background === "transparent" ? "shadow-none" : "shadow-sm"
                      }`}
                      style={{ backgroundColor: background }}
                    >
                      {mode === "qr" ? (
                        qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="Generated QR code"
                            className="h-auto max-h-full w-auto max-w-full object-contain"
                          />
                        ) : (
                          <div className="text-center text-slate-500">
                            QR preview will appear here
                          </div>
                        )
                      ) : (
                        <div className="w-full max-w-[720px]">
                          <svg ref={barcodeRef} className="h-auto w-full max-w-full" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      ref={bulkSheetRef}
                      className={`mx-auto w-full max-w-[1200px] rounded-lg p-2 sm:rounded-xl sm:p-4 ${
                        background === "transparent" ? "shadow-none" : "shadow-sm"
                      }`}
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
                                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3 ${
                                  background === "transparent"
                                    ? "border-transparent bg-transparent"
                                    : "border-[var(--app-border)] bg-[var(--app-surface)]"
                                }`}
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
                                className={`flex flex-col items-center justify-center rounded-2xl border px-4 py-3 ${
                                  background === "transparent"
                                    ? "border-transparent bg-transparent"
                                    : "border-[var(--app-border)] bg-[var(--app-surface)]"
                                }`}
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
          </div>
        </div>
      </section>

    </main>
  );
}
