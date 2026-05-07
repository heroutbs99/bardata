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
import { toPng, toSvg, toCanvas } from "html-to-image";
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
  { label: "Plain text", value: "Hello from Bar/Data" },
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
  const [size, setSize] = useState(320);
  const [margin, setMargin] = useState(2);
  const [columns, setColumns] = useState(2);
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
    setSize(320);
    setMargin(2);
    setColumns(2);
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
    const target = mode === "bulk" ? bulkSheetRef.current : previewRef.current;

    if (!target || error) return;

    const dataUrl = await toPng(target, {
      pixelRatio: 3,
      backgroundColor: background,
    });

    downloadDataUrl(
      dataUrl,
      mode === "bulk" ? "bulk-barcodes-sheet.png" : `${fileBase}.png`
    );
  };

  const downloadSvg = async () => {
    if (mode === "bulk") {
      if (!bulkSheetRef.current || bulkErrors.length) return;

      const svg = await toSvg(bulkSheetRef.current, {
        backgroundColor: background,
      });

      downloadText(svg, "bulk-barcodes-sheet.svg");
      return;
    }

    if (!previewRef.current || error) return;

    const svg = await toSvg(previewRef.current, {
      backgroundColor: background,
    });

    downloadText(svg, `${fileBase}.svg`);
  };

  const downloadCsv = () => {
    const csvRows = [
      "value",
      ...bulkItems.map((item) => `"${item.replace(/"/g, '""')}"`),
    ];

    downloadText(csvRows.join("\n"), "bulk-barcode-values.csv", "text/csv");
  };

  const downloadBulkPdf = async () => {
    if (!bulkSheetRef.current || mode !== "bulk" || bulkErrors.length) return;

    const canvas = await toCanvas(bulkSheetRef.current, {
      pixelRatio: 2,
      backgroundColor: background,
    });

    const pdf = new jsPDF("p", "mm", "a4");

    const marginMm = 10;
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();
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

    pdf.save("bulk-barcodes-sheet.pdf");
  };

  const addBulkError = (invalidValue) => {
    setBulkErrors((prev) =>
      prev.includes(invalidValue) ? prev : [...prev, invalidValue]
    );
  };

  return (
    <main className="min-h-screen bg-[var(--app-bg)] font-sans text-[var(--app-text)] transition-colors duration-300">
      <style jsx global>{`
        :root {
          --app-bg: #f4f7fb;
          --app-surface: #ffffff;
          --app-surface-2: #eef4fb;
          --app-panel: #f8fafc;
          --app-text: #0f172a;
          --app-muted: #64748b;
          --app-border: rgba(15, 23, 42, 0.12);
          --app-accent: #06b6d4;
          --app-accent-soft: rgba(6, 182, 212, 0.12);
          --app-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --app-bg: #050816;
            --app-surface: #111827;
            --app-surface-2: #0b1222;
            --app-panel: #1f2333;
            --app-text: #f8fafc;
            --app-muted: #a7b0c0;
            --app-border: rgba(255, 255, 255, 0.1);
            --app-accent: #22d3ee;
            --app-accent-soft: rgba(34, 211, 238, 0.12);
            --app-shadow: 0 28px 90px rgba(0, 0, 0, 0.35);
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

        .bulk-grid {
          grid-template-columns: 1fr;
        }

        @media (min-width: 768px) {
          .bulk-grid {
            grid-template-columns: repeat(var(--bulk-columns), minmax(0, 1fr));
          }
        }
      `}</style>

      <section className="mx-auto flex min-h-screen w-full max-w-[1900px] flex-col px-4 py-5 sm:px-5 lg:px-8 xl:min-h-[115vh] xl:px-10">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-4 flex shrink-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-4xl space-y-3">
            <div className="inline-flex items-center gap-3 rounded-full border border-[var(--app-border)] bg-[var(--app-accent-soft)] px-4 py-2 text-sm font-bold text-[var(--app-text)]">
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
              <span>Bar/Data</span>
            </div>

            <h1 className="text-balance text-[2.6rem] font-black leading-[0.95] tracking-[-0.045em] sm:text-5xl md:text-6xl xl:text-6xl">
              Generate scannable QR codes and barcodes.
            </h1>

            <p className="max-w-3xl text-base leading-7 text-[var(--app-muted)] md:text-lg">
              Build single codes or bulk barcode sheets for labels, SKUs, products,
              Wi-Fi, links, emails, and inventory workflows.
            </p>
          </div>

          <div className="hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4 shadow-[var(--app-shadow)] lg:block lg:min-w-[320px]">
            <p className="text-sm font-bold text-[var(--app-text)]">
              System appearance enabled
            </p>
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              The interface follows your Mac/browser light or dark mode automatically.
            </p>
          </div>
        </motion.header>

        <div className="grid flex-1 gap-5 xl:grid-cols-[0.78fr_1.22fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="min-h-0 min-w-0"
          >
            <Card className="h-auto overflow-hidden border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[var(--app-shadow)] xl:h-full">
              <CardContent className="h-auto p-4 md:p-5 xl:p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--app-surface-2)] p-1.5 sm:p-2">
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
                        placeholder={"Paste one barcode value per line.\nSKU-1001\nSKU-1002\nSKU-1003"}
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
            <Card className="h-auto overflow-hidden border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[var(--app-shadow)] xl:h-full">
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

                <div className="min-h-[560px] flex-1 overflow-x-hidden rounded-[2rem] bg-[var(--app-surface-2)] p-3 md:min-h-[680px] md:p-5 xl:min-h-[760px] xl:p-7">
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

                <div className="grid shrink-0 gap-3 text-sm text-[var(--app-muted)] md:grid-cols-3">
                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <div className="font-black text-[var(--app-text)]">Client-side</div>
                    <div>No server cost for V1.</div>
                  </div>

                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <div className="font-black text-[var(--app-text)]">
                      Scannable preview
                    </div>
                    <div>1 column on mobile, 2 by default on desktop.</div>
                  </div>

                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <div className="font-black text-[var(--app-text)]">PDF export</div>
                    <div>Bulk sheet downloads as one PDF.</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
