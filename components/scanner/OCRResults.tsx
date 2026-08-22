"use client";

import type { ElementType } from "react";
import { CheckCircle2, AlertTriangle, Loader2, Clock } from "lucide-react";
import type { UploadedImage } from "./ImageUploader";

export type OcrStatus = "WAITING" | "PROCESSING" | "COMPLETE" | "ERROR";

export interface OcrResultState {
  status: OcrStatus;
  text: string;
  confidence: number | null;
  error?: string;
}

interface OCRResultsProps {
  images: UploadedImage[];
  results: Record<string, OcrResultState>;
}

const STATUS_META: Record<
  OcrStatus,
  { label: string; color: string; icon: ElementType }
> = {
  WAITING: {
    label: "WAITING",
    color: "text-status-unknown",
    icon: Clock,
  },
  PROCESSING: {
    label: "PROCESSING",
    color: "text-status-review",
    icon: Loader2,
  },
  COMPLETE: {
    label: "COMPLETE",
    color: "text-status-pass",
    icon: CheckCircle2,
  },
  ERROR: {
    label: "ERROR",
    color: "text-status-fail",
    icon: AlertTriangle,
  },
};

const DEFAULT_RESULT: OcrResultState = {
  status: "WAITING",
  text: "",
  confidence: null,
};

export function OCRResults({ images, results }: OCRResultsProps) {
  if (images.length === 0) return null;

  return (
    <div className="border border-border rounded bg-surface">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
          OCR Results
        </span>
      </div>

      <ul className="divide-y divide-border">
        {images.map((img) => {
          const result = results[img.id] ?? DEFAULT_RESULT;
          const meta = STATUS_META[result.status];
          const Icon = meta.icon;

          return (
            <li key={img.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-ink truncate">
                    {img.file.name}
                  </div>

                  <div className="text-xs text-ink-muted font-mono uppercase tracking-wide">
                    role: {img.role}
                  </div>
                </div>

                <div
                  className={`flex items-center gap-1.5 font-mono text-xs shrink-0 ${meta.color}`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      result.status === "PROCESSING" ? "animate-spin" : ""
                    }`}
                  />
                  {meta.label}
                </div>
              </div>

              {result.status === "COMPLETE" && (
                <div className="bg-bg border border-border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted uppercase tracking-wide">
                      Extracted Text
                    </span>

                    <span className="text-xs font-mono text-ink-muted">
                      confidence:{" "}
                      {result.confidence !== null
                        ? `${result.confidence.toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>

                  <pre className="text-xs font-mono text-ink whitespace-pre-wrap break-words">
                    {result.text.length > 0
                      ? result.text
                      : "(no text detected)"}
                  </pre>
                </div>
              )}

              {result.status === "ERROR" && (
                <div className="bg-bg border border-status-fail/30 rounded p-3">
                  <span className="text-xs font-mono text-status-fail">
                    {result.error ?? "OCR failed for this image."}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}