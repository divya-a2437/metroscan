"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, ClipboardCopy, Check } from "lucide-react";
import type { ComplianceReport, RuleStatus } from "@/lib/rules/types";
import { buildInspectionSummaryText, type InspectionMeta } from "@/lib/inspection";

interface CompliancePanelProps {
  report: ComplianceReport;
  inspection: InspectionMeta;
}

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

export function CompliancePanel({ report, inspection }: CompliancePanelProps) {
  const overall = OVERALL_META[report.overallStatus];
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = buildInspectionSummaryText(inspection, report);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — fail
      // silently rather than breaking the rest of the panel.
    }
  };

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

      <ul className="divide-y divide-border">
        {report.results.map((result) => {
          const meta = RULE_STATUS_META[result.status];
          const Icon = meta.icon;
          const hasEvidence =
            result.evidence !== null ||
            (result.detectedValue !== undefined && result.detectedValue !== null) ||
            (result.confidence !== undefined && result.confidence !== null);

          return (
            <li key={result.ruleId} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
                  <span className="text-sm text-ink font-medium truncate">{result.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-ink-muted">{result.ruleId}</span>
                  <span className={`text-xs font-mono uppercase ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
              </div>

              <p className="text-xs text-ink-muted leading-relaxed">{result.message}</p>

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
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-2 border-t border-border text-xs text-ink-muted leading-relaxed">
        AI-assisted decision-support prototype. This assessment is not a
        legally binding determination — results require human verification
        by a qualified inspector before any enforcement action.
      </div>
    </div>
  );
}