import { createWorker, PSM, type Worker, type Page } from "tesseract.js";
import type { BBox, OcrLineSpatial } from "@/lib/extraction/schema";

/**
 * Module-level singleton so we never spin up more than one Tesseract worker
 * at a time, even if multiple components call into this file. The worker is
 * created lazily on first use, not on module load.
 */
let workerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng").then(async (worker) => {
      // Default page segmentation (AUTO) assumes a full page of continuous
      // text and can scramble reading order when a package label mixes
      // short text blocks with logos/graphics. SPARSE_TEXT is designed for
      // exactly this case — scattered text blocks in no fixed layout — and
      // is a much better match for photographed packaging than a document
      // scan. Set once per worker, not per recognition call.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      return worker;
    });
  }
  return workerPromise;
}

/**
 * Terminates the shared worker (if one exists) and clears the singleton so
 * a future call to recognizeImage() creates a fresh worker.
 */
export async function terminateOcrWorker(): Promise<void> {
  const pending = workerPromise;
  if (!pending) return;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Worker may already be gone (e.g. page unloading) — safe to ignore.
  }
}

export interface OcrOutcome {
  text: string;
  confidence: number;
  /**
   * Optional per-line spatial data (bbox + row height), present only when
   * Tesseract's block output was successfully requested and parsed. This
   * is additive — callers that only read text/confidence are unaffected.
   */
  lines?: OcrLineSpatial[];
}

/**
 * Flattens Tesseract's block -> paragraph -> line tree into a minimal,
 * serializable list of line-level spatial records. Intentionally discards
 * the much larger word/symbol-level detail (choices, font_name, etc.) —
 * line-level bbox + rowHeight is sufficient for what this data will be
 * used for (relative readability comparison, coarse placement evidence),
 * and keeping OcrChunk small matters since it's held in memory per image
 * for the duration of a run.
 */
function flattenLines(page: Page): OcrLineSpatial[] {
  const lines: OcrLineSpatial[] = [];
  const blocks = page.blocks ?? [];

  for (const block of blocks) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const bbox: BBox = {
          x0: line.bbox.x0,
          y0: line.bbox.y0,
          x1: line.bbox.x1,
          y1: line.bbox.y1,
        };
        lines.push({
          text: line.text.trim(),
          confidence: line.confidence,
          bbox,
          rowHeight: line.rowAttributes?.rowHeight ?? null,
        });
      }
    }
  }

  return lines;
}

/** Longest-side cap, in pixels, applied before OCR. */
const MAX_DIMENSION = 2000;

/**
 * Prepares an uploaded image for OCR using only the browser's native
 * Canvas API — no new dependency. Two adjustments are made:
 *
 * 1. Downscale: modern phone photos are often 3000-4000px+ on the long
 *    side. That's far more resolution than OCR needs and mainly costs
 *    processing time (relevant for a live demo), so anything above
 *    MAX_DIMENSION is scaled down proportionally.
 * 2. Grayscale + contrast stretch: converts to grayscale and rescales the
 *    brightness range so the darkest pixel becomes black and the lightest
 *    becomes white. This targets low/uneven contrast from indoor lighting
 *    and glossy packaging, a common real-world cause of misrecognition.
 *
 * This never touches or discards OCR text — it only reshapes pixels
 * before recognition. If preprocessing fails for any reason (unsupported
 * image format, Canvas unavailable), the caller falls back to running OCR
 * on the original file.
 */
async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  const longestSide = Math.max(width, height);
  if (longestSide > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longestSide;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  // First pass: grayscale conversion (standard luminance weighting) while
  // tracking the min/max brightness seen.
  const gray = new Float32Array(data.length / 4);
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[i / 4] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }

  // Second pass: stretch the brightness range to fill 0-255. Guard against
  // a flat/blank image (min === max) to avoid dividing by zero.
  const range = max - min || 1;
  for (let i = 0; i < data.length; i += 4) {
    const stretched = ((gray[i / 4] - min) / range) * 255;
    data[i] = data[i + 1] = data[i + 2] = stretched;
    // Alpha channel (data[i + 3]) is left unchanged.
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Runs OCR on a single image file using the shared worker. The image is
 * preprocessed first (downscale + grayscale + contrast stretch); if that
 * fails for any reason, OCR runs on the original file instead. Callers are
 * expected to run images sequentially (the scanner page does this) so a
 * single worker handles one recognition job at a time.
 */
export async function recognizeImage(file: File): Promise<OcrOutcome> {
  const worker = await getOcrWorker();

  let input: File | HTMLCanvasElement = file;
  try {
    input = await preprocessImage(file);
  } catch {
    input = file;
  }

  // Request block-level output in addition to the default text/confidence.
  // Blocks are NOT returned by default — Tesseract.js only computes/returns
  // them when explicitly asked for via the third (output formats) argument.
  const { data } = await worker.recognize(input, {}, { blocks: true });

  let lines: OcrLineSpatial[] | undefined;
  try {
    lines = flattenLines(data);
  } catch {
    // If block parsing fails for any reason, spatial data is simply
    // unavailable for this image — text/confidence are unaffected, and
    // extraction already handles a missing `lines` array as a normal case.
    lines = undefined;
  }

  return {
    text: data.text.trim(),
    confidence: data.confidence,
    lines,
  };
}