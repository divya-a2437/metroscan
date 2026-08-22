import { createWorker, type Worker } from "tesseract.js";

/**
 * Module-level singleton so we never spin up more than one Tesseract worker
 * at a time, even if multiple components call into this file. The worker is
 * created lazily on first use, not on module load.
 */
let workerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng");
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
}

/**
 * Runs OCR on a single image file using the shared worker. Callers are
 * expected to run images sequentially (the scanner page does this) so a
 * single worker handles one recognition job at a time.
 */
export async function recognizeImage(file: File): Promise<OcrOutcome> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(file);
  return {
    text: data.text.trim(),
    confidence: data.confidence,
  };
}