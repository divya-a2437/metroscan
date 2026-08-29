import type { FieldEvidence } from "@/lib/extraction/schema";

/**
 * PASS      — a valid-looking declaration was found for this requirement.
 * FAIL      — a declaration was found but is malformed/invalid, OR the
 *             available evidence is sufficient to establish non-compliance.
 * REVIEW    — the field is missing or ambiguous and a human needs to check
 *             the actual package, since OCR/extraction can miss text that
 *             is genuinely present on the label.
 * NOT_CHECKED — applicability itself could not be established from the
 *             available data (e.g. country-of-origin only applies to
 *             imported goods, and we have no reliable signal either way).
 */
export type RuleStatus = "PASS" | "FAIL" | "REVIEW" | "NOT_CHECKED";

export type RuleSeverity = "HIGH" | "MEDIUM" | "LOW";

/**
 * Broad category of what a rule is checking. Optional and purely
 * informational — added so the UI can group/filter rules later without
 * any change to how PASS/FAIL/REVIEW/NOT_CHECKED is decided.
 */
export type RuleCategory = "DECLARATION" | "VALUE" | "READABILITY" | "PLACEMENT" | "FORMAT";

export interface RuleResult {
  ruleId: string;
  title: string;
  field: string;
  status: RuleStatus;
  message: string;
  evidence: FieldEvidence | null;
  severity: RuleSeverity;
  /**
   * The concrete extracted value this decision was based on, when one
   * exists (e.g. "45" for MRP, "200 g" for net quantity). Optional and
   * only populated where a rule actually used a value to decide — REVIEW
   * and NOT_CHECKED results generally have nothing concrete to show here.
   */
  detectedValue?: string | null;
  /** OCR confidence (0–100) of the source image the value came from. */
  confidence?: number | null;
  /** Broad category of this check — optional, additive, informational only. */
  category?: RuleCategory;
}

export type OverallStatus = "PASS" | "FAIL" | "REVIEW";

export interface ComplianceSummary {
  pass: number;
  fail: number;
  review: number;
  notChecked: number;
}

export interface ComplianceReport {
  overallStatus: OverallStatus;
  results: RuleResult[];
  summary: ComplianceSummary;
}