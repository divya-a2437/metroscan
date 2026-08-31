"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  ClipboardCopy,
  Check,
  ChevronDown,
  Images,
} from "lucide-react";
import type { ComplianceReport, RuleResult, RuleStatus } from "@/lib/rules/types";
import { buildInspectionSummaryText, type InspectionMeta } from "@/lib/inspection";
import type { CoverageAssessment, CoverageState } from "@/lib/rules/coverageAssessment";

interface CompliancePanelProps {
  report: ComplianceReport;
  inspection: InspectionMeta;
  coverage: CoverageAssessment | null;
}

const COVERAGE_META: Record<CoverageState, { label: string; color: string; bg: string }> = {
  ADEQUATE: { label: "ADEQUATE COVERAGE", color: "text-status-pass", bg: "bg-status-pass/5" },
  LIMITED: { label: "LIMITED COVERAGE", color: "text-status-review", bg: "bg-status-review/5" },
  INSUFFICIENT: { label: "INSUFFICIENT COVERAGE", color: "text-status-fail", bg: "bg-status-fail/5" },
};

type OverallStatusMeta = { label: string; color: string; bg: string };

const OVERALL_META: Record<ComplianceReport["overallStatus"], OverallStatusMeta> = {
  PASS: { label: "PASS", color: "text-status-pass", bg: "bg-status-pass/10" },
  FAIL: { label: "FAIL", color: "text-status-fail", bg: "bg-status-fail/10" },
  REVIEW: { label: "REVIEW REQUIRED", color: "text-status-review", bg: "bg-status-review/10" },
};

type RuleStatusMeta = { label: string; color: string; icon: typeof CheckCircle2 };

const RULE_STATUS_META: Record<RuleStatus, RuleStatusMeta> = {
  PASS: { label: "PASS", color: "text-status-pass", icon: CheckCircle2 },
  FAIL: { label: "FAIL", color: "text-status-fail", icon: XCircle },
  REVIEW: { label: "REVIEW", color: "text-status-review", icon: AlertTriangle },
  NOT_CHECKED: { label: "NOT CHECKED", color: "text-status-unknown", icon: MinusCircle },
};

/** Left-border accent used to make FAIL/REVIEW rows visually heavier than PASS/NOT_CHECKED. */
const ATTENTION_BORDER: Record<RuleStatus, string> = {
  PASS: "border-l-transparent",
  FAIL: "border-l-status-fail",
  REVIEW: "border-l-status-review",
  NOT_CHECKED: "border-l-transparent",
};

/**
 * Visual tint for the reasoning-chain box, one per non-PASS status. REVIEW
 * gets the most prominent tint per the "make reasoning especially
 * prominent for REVIEW" requirement; NOT_CHECKED stays neutral since it
 * represents unresolved applicability rather than a problem finding.
 */
const REASONING_BOX_STYLE: Partial<Record<RuleStatus, string>> = {
  FAIL: "border-status-fail/30 bg-status-fail/5",
  REVIEW: "border-status-review/40 bg-status-review/10",
  NOT_CHECKED: "border-status-unknown/30 bg-status-unknown/5",
};

/**
 * Describes, in conservative generic terms, what class of check this rule
 * performs — derived only from the existing optional `category` field.
 * Never claims specifics the rule result doesn't actually establish.
 */
function getCheckedDescription(result: RuleResult): string {
  switch (result.category) {
    case "DECLARATION":
      return "Presence of this declaration in the extracted package data";
    case "VALUE":
      return "Validity of the extracted value for this declaration";
    case "READABILITY":
      return "Relative text-size comparison across extracted evidence on the same image";
    case "PLACEMENT":
      return "Evidence location within submitted images";
    case "FORMAT":
      return "Format validity of the extracted value";
    default:
      return "Extracted package data for this requirement";
  }
}

/**
 * Describes what was actually found, using only detectedValue/evidence
 * that already exist on the result. Falls back to conservative wording
 * rather than ever implying something was found when it wasn't.
 */
function getFoundDescription(result: RuleResult): string {
  if (result.detectedValue) {
    return `Detected: ${result.detectedValue}`;
  }
  if (result.evidence) {
    return `Related evidence: "${result.evidence.rawText}" (${result.evidence.sourceImage}, ${result.evidence.sourceRole.toUpperCase()})`;
  }
  return "No matching declaration detected in submitted evidence";
}

function ReasoningRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wide">{label}</div>
      <div className="text-xs text-ink leading-snug">{value}</div>
    </div>
  );
}

export function CompliancePanel({ report, inspection, coverage }: CompliancePanelProps) {
  const overall = OVERALL_META[report.overallStatus];
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopy = async () => {
    const text = buildInspectionSummaryText(inspection, report);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  };

  const attentionResults = report.results.filter(
    (r) => r.status === "FAIL" || r.status === "REVIEW"
  );

  return (
    <div className="border border-border rounded bg-surface">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
          Compliance Assessment
        </span>
        <span className="text-xs font-mono text-ink-muted">PROTOTYPE — RULE ENGINE</span>
      </div>

      {/* Inspection Summary */}
      <div className={`px-4 py-3 border-b border-border ${overall.bg}`}>
        <div className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">
          Inspection Summary
        </div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-4 text-xs font-mono text-ink-muted">
            <span>{inspection.inspectionId}</span>
            <span>{new Date(inspection.timestamp).toLocaleString()}</span>
            <span>
              {inspection.imageCount} image{inspection.imageCount !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-medium text-ink border border-border rounded px-2 py-1 bg-surface hover:bg-bg transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-status-pass" />
                Copied
              </>
            ) : (
              <>
                <ClipboardCopy className="w-3.5 h-3.5" />
                Copy Inspection Summary
              </>
            )}
          </button>
        </div>

        {copyError && (
          <div className="text-xs font-mono text-status-fail mb-3">
            Copy failed — clipboard access unavailable in this browser/context.
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-ink-muted uppercase tracking-wide mb-0.5">Overall</div>
            <div className={`text-sm font-semibold ${overall.color}`}>{overall.label}</div>
          </div>
          <div className="flex gap-4 text-xs font-mono text-ink-muted">
            <span>pass {report.summary.pass}</span>
            <span>fail {report.summary.fail}</span>
            <span>review {report.summary.review}</span>
            <span>n/c {report.summary.notChecked}</span>
          </div>
        </div>
      </div>

      {/* Image Coverage */}
      {coverage && (
        <div className={`px-4 py-3 border-b border-border ${COVERAGE_META[coverage.state].bg}`}>
          <div className="flex items-center gap-2 mb-2">
            <Images className="w-4 h-4 text-ink-muted" />
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
              Image Coverage
            </span>
          </div>

          <div className={`text-sm font-semibold mb-1.5 ${COVERAGE_META[coverage.state].color}`}>
            {COVERAGE_META[coverage.state].label}
          </div>

          <p className="text-xs text-ink-muted leading-relaxed mb-2">{coverage.summary}</p>

          {coverage.missingRoles.length > 0 && (
            <div className="text-xs font-mono text-ink-muted mb-2">
              <span className="text-ink-muted uppercase tracking-wide">
                Additional panel coverage recommended:{" "}
              </span>
              <span className="text-ink">
                {coverage.missingRoles.map((r) => r.toUpperCase()).join(" • ")}
              </span>
            </div>
          )}

          {coverage.affectedFields.length > 0 && (
            <div className="bg-bg border border-border rounded px-3 py-2 space-y-1.5">
              <div className="text-xs text-ink-muted uppercase tracking-wide">
                {coverage.affectedFields.length} declaration check
                {coverage.affectedFields.length !== 1 ? "s" : ""} may be affected by incomplete
                image coverage
              </div>
              <ul className="text-xs text-ink space-y-1">
                {coverage.affectedFields.map((f) => (
                  <li key={f.field} className="flex items-baseline justify-between gap-2">
                    <span>{f.field}</span>
                    <span className="font-mono text-ink-muted shrink-0">
                      needs {f.recommendedRoles.map((r) => r.toUpperCase()).join("/")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-muted leading-relaxed pt-1 border-t border-border">
                Capture additional images for these panels before treating the related REVIEW
                results as confirmed omissions.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Issues Requiring Attention */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
            Issues Requiring Attention
          </span>
          {attentionResults.length > 0 && (
            <span className="text-xs font-mono text-status-fail">
              {attentionResults.length}
            </span>
          )}
        </div>

        {attentionResults.length === 0 ? (
          <div className="px-4 pb-3 flex items-center gap-2 text-xs text-status-pass font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            No issues requiring attention detected.
          </div>
        ) : (
          <ul className="px-4 pb-3 space-y-1.5">
            {attentionResults.map((result) => {
              const meta = RULE_STATUS_META[result.status];
              const Icon = meta.icon;
              return (
                <li
                  key={result.ruleId}
                  className={`flex items-start gap-2 text-xs rounded px-2 py-1.5 ${
                    result.status === "FAIL"
                      ? "bg-status-fail/5"
                      : "bg-status-review/5"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.color}`} />
                  <div className="min-w-0">
                    <span className="font-medium text-ink">{result.title}</span>
                    <span className={`ml-2 font-mono uppercase text-[10px] ${meta.color}`}>
                      {meta.label}
                    </span>
                    <p className="text-ink-muted mt-0.5 leading-snug">{result.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Full rule list — expandable per rule, FAIL/REVIEW open by default */}
      <ul className="divide-y divide-border">
        {report.results.map((result) => {
          const meta = RULE_STATUS_META[result.status];
          const Icon = meta.icon;
          const isAttention = result.status === "FAIL" || result.status === "REVIEW";
          const hasEvidence =
            result.evidence !== null ||
            (result.detectedValue !== undefined && result.detectedValue !== null) ||
            (result.confidence !== undefined && result.confidence !== null);

          return (
            <li
              key={result.ruleId}
              className={`border-l-4 ${ATTENTION_BORDER[result.status]}`}
            >
              <details open={isAttention} className="group">
                <summary className="px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 hover:bg-bg/60 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
                    <span className="text-sm text-ink font-medium truncate">
                      {result.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-ink-muted">{result.ruleId}</span>
                    <span className={`text-xs font-mono uppercase ${meta.color}`}>
                      {meta.label}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-ink-muted transition-transform group-open:rotate-180" />
                  </div>
                </summary>

                <div className="px-4 pb-3 space-y-1.5">
                  {result.status === "PASS" ? (
                    <p className="text-xs text-ink-muted leading-relaxed">{result.message}</p>
                  ) : (
                    <div
                      className={`rounded border px-3 py-2 space-y-2 ${
                        REASONING_BOX_STYLE[result.status] ?? "border-border bg-bg"
                      }`}
                    >
                      <ReasoningRow label="Requirement" value={result.title} />
                      <ReasoningRow label="Checked" value={getCheckedDescription(result)} />
                      <ReasoningRow label="Found" value={getFoundDescription(result)} />
                      <ReasoningRow
                        label="Conclusion"
                        value={`${result.status} — ${result.message}`}
                      />
                    </div>
                  )}

                  {hasEvidence && (
                    <div className="bg-bg border border-border rounded px-3 py-2 space-y-1">
                      {result.detectedValue !== undefined && result.detectedValue !== null && (
                        <div className="text-xs text-ink">
                          <span className="text-ink-muted">Detected value: </span>
                          <span className="font-mono">{result.detectedValue}</span>
                        </div>
                      )}
                      {result.evidence && (
                        <div className="text-xs font-mono text-ink-muted truncate">
                          &ldquo;{result.evidence.rawText}&rdquo; — {result.evidence.sourceImage} (
                          {result.evidence.sourceRole.toUpperCase()})
                        </div>
                      )}
                      {result.confidence !== undefined && result.confidence !== null && (
                        <div className="text-xs font-mono text-ink-muted">
                          OCR confidence: {result.confidence.toFixed(0)}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-3 border-t-2 border-ink bg-ink/[0.03] flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-ink shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-semibold text-ink uppercase tracking-wide">
            Automated Screening Complete — Human Verification Required
          </div>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            MetroScan is a decision-support tool. This screening result must
            be verified by a qualified inspector before any enforcement,
            reporting, or legal action.
          </p>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-border text-xs text-ink-muted leading-relaxed">
        AI-assisted decision-support prototype. This assessment is not a
        legally binding determination — results require human verification
        by a qualified inspector before any enforcement action.
      </div>
    </div>
  );
}