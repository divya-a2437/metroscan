"use client";

export type PipelineStageState = "PENDING" | "ACTIVE" | "COMPLETE" | "ERROR";

export interface PipelineStage {
  id: string;
  number: string;
  label: string;
  state: PipelineStageState;
}

interface PipelineStatusProps {
  stages: PipelineStage[];
}

const STATE_META: Record<PipelineStageState, { dot: string; text: string; label: string }> = {
  PENDING: { dot: "bg-status-unknown", text: "text-ink-muted", label: "PENDING" },
  ACTIVE: { dot: "bg-status-review", text: "text-status-review", label: "IN PROGRESS" },
  COMPLETE: { dot: "bg-status-pass", text: "text-status-pass", label: "COMPLETE" },
  ERROR: { dot: "bg-status-fail", text: "text-status-fail", label: "ERROR" },
};

/**
 * Reflects real pipeline state only — every stage's state is derived
 * directly from actual application state in app/scanner/page.tsx. No
 * fake/simulated progress.
 */
export function PipelineStatus({ stages }: PipelineStatusProps) {
  return (
    <div className="border border-border rounded bg-surface p-4">
      <div className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-3">
        Inspection Pipeline
      </div>
      <ol>
        {stages.map((stage, i) => {
          const meta = STATE_META[stage.state];
          const isLast = i === stages.length - 1;
          return (
            <li key={stage.id} className="relative pl-6 pb-4 last:pb-0">
              {!isLast && (
                <span className="absolute left-1.75 top-4 bottom-0 w-px bg-border" aria-hidden />
              )}
              <span
                className={`absolute left-0 top-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface ${meta.dot}`}
                aria-hidden
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-ink-muted">{stage.number}</span>
                <span className="flex-1 text-sm text-ink font-medium">{stage.label}</span>
                <span className={`text-[10px] font-mono uppercase tracking-wide ${meta.text}`}>
                  {meta.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}