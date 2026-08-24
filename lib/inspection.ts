import type { ComplianceReport, OverallStatus } from "@/lib/rules/types";

export interface InspectionMeta {
  inspectionId: string;
  /** ISO timestamp, generated client-side. Not persisted anywhere. */
  timestamp: string;
  imageCount: number;
}

/**
 * Generates a client-side-only inspection identifier, e.g. "INS-2026-08-23-9F3K".
 * This is NOT a database ID — it exists purely to give the inspector a
 * reference label to quote during a demo or a paper/manual audit trail.
 */
export function generateInspectionId(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INS-${yyyy}-${mm}-${dd}-${suffix}`;
}

function overallLabel(status: OverallStatus): string {
  return status === "REVIEW" ? "REVIEW REQUIRED" : status;
}

/**
 * Builds the plain-text summary copied to the clipboard by the
 * "Copy Inspection Summary" button. Kept as a pure function (no DOM/
 * clipboard access) so it can be reused or unit-tested independently of
 * the UI component.
 */
export function buildInspectionSummaryText(
  meta: InspectionMeta,
  report: ComplianceReport
): string {
  const lines: string[] = [];

  lines.push("MetroScan Inspection");
  lines.push(`Inspection ID: ${meta.inspectionId}`);
  lines.push(`Date: ${new Date(meta.timestamp).toLocaleString()}`);
  lines.push(`Images Scanned: ${meta.imageCount}`);
  lines.push(`Overall: ${overallLabel(report.overallStatus)}`);
  lines.push("");
  lines.push(`PASS: ${report.summary.pass}`);
  lines.push(`FAIL: ${report.summary.fail}`);
  lines.push(`REVIEW: ${report.summary.review}`);
  lines.push(`NOT CHECKED: ${report.summary.notChecked}`);
  lines.push("");

  for (const result of report.results) {
    lines.push(`${result.ruleId} ${result.title} — ${result.status}`);
  }

  lines.push("");
  lines.push(
    "AI-assisted decision-support prototype. Not a legally binding compliance determination — results require human verification."
  );

  return lines.join("\n");
}