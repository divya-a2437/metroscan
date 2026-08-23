import type { ProductDeclaration } from "@/lib/extraction/schema";
import { PACKAGED_COMMODITY_RULES } from "./packagedCommodityRules";
import type { ComplianceReport, ComplianceSummary, OverallStatus, RuleResult } from "./types";

/**
 * Runs the full prototype rule set against a ProductDeclaration and
 * returns a structured compliance report. Purely deterministic — no
 * AI/LLM involvement. This function has no dependency on OCR, extraction
 * internals, or any UI component; it only depends on the ProductDeclaration
 * shape produced by Step 3.
 */
export function evaluateCompliance(declaration: ProductDeclaration): ComplianceReport {
  const results: RuleResult[] = PACKAGED_COMMODITY_RULES.map((rule) => rule(declaration));

  const summary: ComplianceSummary = {
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    review: results.filter((r) => r.status === "REVIEW").length,
    notChecked: results.filter((r) => r.status === "NOT_CHECKED").length,
  };

  let overallStatus: OverallStatus;
  if (summary.fail > 0) {
    overallStatus = "FAIL";
  } else if (summary.review > 0) {
    overallStatus = "REVIEW";
  } else {
    overallStatus = "PASS";
  }

  return { overallStatus, results, summary };
}