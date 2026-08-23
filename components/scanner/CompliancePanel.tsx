"use client";

import { CheckCircle2, XCircle, AlertTriangle, MinusCircle } from "lucide-react";
import type { ComplianceReport, RuleStatus } from "@/lib/rules/types";

interface CompliancePanelProps {
  report: ComplianceReport;
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

export function CompliancePanel({ report }: CompliancePanelProps) {
  const overall = OVERALL_META[report.overallStatus];

  return (
    <div className="border border-border rounded bg-surface">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
          Compliance Assessment
        </span>
        <span className="text-xs font-mono text-ink-muted">PROTOTYPE — RULE ENGINE</span>
      </div>

      <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${overall.bg}`}>
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

      <ul className="divide-y divide-border">
        {report.results.map((result) => {
          const meta = RULE_STATUS_META[result.status];
          const Icon = meta.icon;
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

              {result.evidence && (
                <div className="text-xs font-mono text-ink-muted bg-bg border border-border rounded px-2 py-1 truncate">
                  &ldquo;{result.evidence.rawText}&rdquo; — {result.evidence.sourceImage} (
                  {result.evidence.sourceRole})
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