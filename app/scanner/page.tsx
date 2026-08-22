"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUploader, UploadedImage } from "@/components/scanner/ImageUploader";
import { OCRResults, OcrResultState, OcrStatus } from "@/components/scanner/OCRResults";
import { recognizeImage, terminateOcrWorker } from "@/lib/ocr";

export default function ScannerPage() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [ocrResults, setOcrResults] = useState<Record<string, OcrResultState>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  // Track whether OCR has run at least once, purely for button label text.
  const hasRunOnce = useRef(false);

  // Clean up the shared Tesseract worker when the scanner page unmounts.
  useEffect(() => {
    return () => {
      terminateOcrWorker();
    };
  }, []);

  const runOcr = async () => {
    if (images.length === 0 || isProcessing) return;

    setIsProcessing(true);
    hasRunOnce.current = true;

    // Reset status for the images we're about to (re)process.
    setOcrResults((prev) => {
      const next = { ...prev };
      images.forEach((img) => {
        next[img.id] = { status: "WAITING", text: "", confidence: null };
      });
      return next;
    });

    // Run sequentially through the shared worker — avoids spinning up
    // multiple Tesseract workers at once.
    for (const img of images) {
      setCurrentFileName(img.file.name);
      setOcrResults((prev) => ({
        ...prev,
        [img.id]: { status: "PROCESSING", text: "", confidence: null },
      }));

      try {
        const { text, confidence } = await recognizeImage(img.file);
        setOcrResults((prev) => ({
          ...prev,
          [img.id]: { status: "COMPLETE", text, confidence },
        }));
      } catch (err) {
        setOcrResults((prev) => ({
          ...prev,
          [img.id]: {
            status: "ERROR",
            text: "",
            confidence: null,
            error: err instanceof Error ? err.message : "OCR failed for this image.",
          },
        }));
      }
    }

    setCurrentFileName(null);
    setIsProcessing(false);
  };

  // Aggregate pipeline status for the sidebar, derived from per-image results.
  const relevantResults = images.map((img) => ocrResults[img.id]?.status);
  const pipelineOcrStatus: OcrStatus | "PENDING" =
    relevantResults.length === 0
      ? "PENDING"
      : relevantResults.some((s) => s === "ERROR")
      ? "ERROR"
      : relevantResults.some((s) => s === "PROCESSING")
      ? "PROCESSING"
      : relevantResults.every((s) => s === "COMPLETE")
      ? "COMPLETE"
      : "PENDING";

  const pipelineStatusColor: Record<string, string> = {
    PENDING: "text-ink-muted",
    WAITING: "text-status-unknown",
    PROCESSING: "text-status-review",
    COMPLETE: "text-status-pass",
    ERROR: "text-status-fail",
  };

  const buttonLabel = isProcessing
    ? "OCR Processing…"
    : hasRunOnce.current
    ? "Re-run OCR"
    : "Run OCR";

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-ink">Product Scanner</h1>
        <p className="text-sm text-ink-muted mt-1">
          Upload one or more package images (front, back, side, top, bottom)
          to begin extraction.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <ImageUploader images={images} onChange={setImages} />
          <OCRResults images={images} results={ocrResults} />
        </div>

        <aside className="border border-border rounded bg-surface p-4 h-fit">
          <div className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-3">
            Pipeline Status
          </div>
          <ol className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-ink">Image upload</span>
              <span className="font-mono text-xs text-status-pass">
                {images.length > 0 ? "READY" : "WAITING"}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink">OCR extraction</span>
              <span
                className={`font-mono text-xs ${pipelineStatusColor[pipelineOcrStatus]}`}
              >
                {pipelineOcrStatus}
              </span>
            </li>
            <li className="flex items-center justify-between opacity-40">
              <span className="text-ink">Declaration extraction</span>
              <span className="font-mono text-xs text-ink-muted">PENDING</span>
            </li>
            <li className="flex items-center justify-between opacity-40">
              <span className="text-ink">Rule evaluation</span>
              <span className="font-mono text-xs text-ink-muted">PENDING</span>
            </li>
          </ol>

          <button
            onClick={runOcr}
            disabled={images.length === 0 || isProcessing}
            className="w-full mt-4 text-sm font-medium rounded px-3 py-2 bg-ink text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {buttonLabel}
          </button>

          {isProcessing && currentFileName && (
            <div className="mt-3 text-xs font-mono text-status-review border border-status-review/30 bg-status-review/5 rounded px-2 py-1.5">
              OCR PROCESSING — {currentFileName}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}