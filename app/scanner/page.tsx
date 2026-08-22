"use client";

import { useState } from "react";
import { ImageUploader, UploadedImage } from "@/components/scanner/ImageUploader";

export default function ScannerPage() {
  const [images, setImages] = useState<UploadedImage[]>([]);

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
        <ImageUploader images={images} onChange={setImages} />

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
            <li className="flex items-center justify-between opacity-40">
              <span className="text-ink">OCR extraction</span>
              <span className="font-mono text-xs text-ink-muted">STEP 2</span>
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
            disabled={images.length === 0}
            className="w-full mt-4 text-sm font-medium rounded px-3 py-2 bg-ink text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            Run OCR (Step 2)
          </button>
        </aside>
      </div>
    </div>
  );
}