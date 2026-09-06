"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUploader, UploadedImage } from "@/components/scanner/ImageUploader";
import { OCRResults, OcrResultState, OcrStatus } from "@/components/scanner/OCRResults";
import { DeclarationPanel } from "@/components/scanner/DeclarationPanel";
import { CompliancePanel } from "@/components/scanner/CompliancePanel";
import { PipelineStatus, type PipelineStage } from "@/components/scanner/PipelineStatus";
import { recognizeImage, terminateOcrWorker } from "@/lib/ocr";
import { extractDeclaration } from "@/lib/extraction/deterministicExtractor";
import type { OcrChunk, ProductDeclaration } from "@/lib/extraction/schema";
import { evaluateCompliance } from "@/lib/rules/evaluateCompliance";
import type { ComplianceReport } from "@/lib/rules/types";
import { generateInspectionId, type InspectionMeta } from "@/lib/inspection";
import { assessImageCoverage, type CoverageAssessment } from "@/lib/rules/coverageAssessment";

export default function ScannerPage() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [ocrResults, setOcrResults] = useState<Record<string, OcrResultState>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [declaration, setDeclaration] = useState<ProductDeclaration | null>(null);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [inspectionMeta, setInspectionMeta] = useState<InspectionMeta | null>(null);
  const [coverage, setCoverage] = useState<CoverageAssessment | null>(null);

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
    setDeclaration(null); // clear any previous extraction while re-running
    setComplianceReport(null); // clear any previous compliance result while re-running
    setInspectionMeta(null); // clear any previous inspection metadata while re-running
    setCoverage(null); // clear any previous coverage assessment while re-running

    // Reset status for the images we're about to (re)process.
    setOcrResults((prev) => {
      const next = { ...prev };
      images.forEach((img) => {
        next[img.id] = { status: "WAITING", text: "", confidence: null };
      });
      return next;
    });

    // Collected locally (not from state) so extraction can run immediately
    // after the loop without waiting on React state batching.
    const collectedChunks: OcrChunk[] = [];

    // Run sequentially through the shared worker — avoids spinning up
    // multiple Tesseract workers at once.
    for (const img of images) {
      setCurrentFileName(img.file.name);
      setOcrResults((prev) => ({
        ...prev,
        [img.id]: { status: "PROCESSING", text: "", confidence: null },
      }));

      try {
        const { text, confidence, lines } = await recognizeImage(img.file);
        setOcrResults((prev) => ({
          ...prev,
          [img.id]: { status: "COMPLETE", text, confidence },
        }));
        collectedChunks.push({
          imageId: img.id,
          fileName: img.file.name,
          role: img.role,
          text,
          confidence,
          lines,
        });
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
        // Images that fail OCR simply contribute no text — extraction still
        // runs on whatever succeeded.
      }
    }

    setCurrentFileName(null);
    setIsProcessing(false);

    // Structured declaration extraction — deterministic, no AI/LLM call.
    // Runs even if some images failed OCR or produced no text.
    const nextDeclaration = extractDeclaration(collectedChunks);
    setDeclaration(nextDeclaration);

    // Rule engine evaluation — deterministic, no AI/LLM call, and fully
    // independent from OCR/extraction internals (only depends on the
    // ProductDeclaration shape).
    setComplianceReport(evaluateCompliance(nextDeclaration));

    // Evidence-coverage assessment — isolated from the rule engine and
    // never alters any RuleResult status. Only depends on which image
    // roles were submitted and which declaration fields were detected.
    setCoverage(assessImageCoverage(images.map((img) => img.role), nextDeclaration));

    // Client-side-only inspection metadata (ID + timestamp) generated once
    // per completed run. Not persisted anywhere — no database in this step.
    setInspectionMeta({
      inspectionId: generateInspectionId(),
      timestamp: new Date().toISOString(),
      imageCount: images.length,
    });
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

  // Five-stage pipeline indicator — every state below is derived from real
  // application state, not simulated. VERIFY never auto-completes: human
  // verification is an action outside this application's ability to confirm.
  const pipelineStages: PipelineStage[] = [
    {
      id: "capture",
      number: "01",
      label: "Capture",
      state: images.length > 0 ? "COMPLETE" : "PENDING",
    },
    {
      id: "ocr",
      number: "02",
      label: "OCR",
      state:
        pipelineOcrStatus === "ERROR"
          ? "ERROR"
          : pipelineOcrStatus === "PROCESSING"
          ? "ACTIVE"
          : pipelineOcrStatus === "COMPLETE"
          ? "COMPLETE"
          : "PENDING",
    },
    {
      id: "extract",
      number: "03",
      label: "Extract",
      state: declaration ? "COMPLETE" : "PENDING",
    },
    {
      id: "screen",
      number: "04",
      label: "Screen",
      state: complianceReport ? "COMPLETE" : "PENDING",
    },
    {
      id: "verify",
      number: "05",
      label: "Verify",
      state: complianceReport ? "ACTIVE" : "PENDING",
    },
  ];

  const buttonLabel = isProcessing
    ? "OCR Processing…"
    : hasRunOnce.current
    ? "Re-run OCR"
    : "Run OCR";

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-ink">Product Scanner</h1>
          <p className="text-sm text-ink-muted mt-1">
            Upload one or more package images (front, back, side, top, bottom)
            to begin extraction.
          </p>
        </div>
        <div className="text-xs font-mono text-ink-muted text-right space-y-0.5">
          <div>
            {images.length} image{images.length !== 1 ? "s" : ""} in this inspection
          </div>
          {inspectionMeta && (
            <>
              <div>{inspectionMeta.inspectionId}</div>
              <div>{new Date(inspectionMeta.timestamp).toLocaleString()}</div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <ImageUploader images={images} onChange={setImages} />
          <OCRResults images={images} results={ocrResults} />
          {images.length > 0 && declaration && (
            <DeclarationPanel declaration={declaration} />
          )}
          {images.length > 0 && complianceReport && inspectionMeta && (
            <CompliancePanel
              report={complianceReport}
              inspection={inspectionMeta}
              coverage={coverage}
            />
          )}
        </div>

        <aside className="space-y-4 h-fit">
          <PipelineStatus stages={pipelineStages} />

          <div className="border border-border rounded bg-surface p-4">
            <button
              onClick={runOcr}
              disabled={images.length === 0 || isProcessing}
              className="w-full text-sm font-medium rounded px-3 py-2 bg-ink text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
            >
              {buttonLabel}
            </button>

            {isProcessing && currentFileName && (
              <div className="mt-3 text-xs font-mono text-status-review border border-status-review/30 bg-status-review/5 rounded px-2 py-1.5">
                OCR PROCESSING — {currentFileName}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}