"use client";

import { DECLARATION_FIELD_ORDER, type ProductDeclaration } from "@/lib/extraction/schema";

interface DeclarationPanelProps {
  declaration: ProductDeclaration;
}

/**
 * Renders extracted fields only — this panel makes no compliance judgment.
 * "Not detected" simply means the deterministic extractor found no match;
 * it is not a violation finding. That determination belongs to the rule
 * engine, added in a later step.
 */
export function DeclarationPanel({ declaration }: DeclarationPanelProps) {
  return (
    <div className="border border-border rounded bg-surface">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
          Extracted Declaration
        </span>
        <span className="text-xs font-mono text-ink-muted">DETERMINISTIC</span>
      </div>
      <ul className="divide-y divide-border">
        {DECLARATION_FIELD_ORDER.map(({ key, label }) => {
          if (key === "net_quantity") {
            const field = declaration.net_quantity;
            const detected = field.value !== null && field.unit !== null;
            return (
              <li key={key} className="px-4 py-3">
                <FieldRow
                  label={label}
                  detected={detected}
                  displayValue={detected ? `${field.value} ${field.unit}` : null}
                  confidence={field.confidence}
                  rawText={field.evidence?.rawText ?? null}
                  sourceImage={field.evidence?.sourceImage ?? null}
                  sourceRole={field.evidence?.sourceRole ?? null}
                />
              </li>
            );
          }

          const field = declaration[key];
          const detected = field.value !== null && field.value !== "";
          return (
            <li key={key} className="px-4 py-3">
              <FieldRow
                label={label}
                detected={detected}
                displayValue={field.value}
                confidence={field.confidence}
                rawText={field.evidence?.rawText ?? null}
                sourceImage={field.evidence?.sourceImage ?? null}
                sourceRole={field.evidence?.sourceRole ?? null}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface FieldRowProps {
  label: string;
  detected: boolean;
  displayValue: string | null;
  confidence: number | null;
  rawText: string | null;
  sourceImage: string | null;
  sourceRole: string | null;
}

function FieldRow({
  label,
  detected,
  displayValue,
  confidence,
  rawText,
  sourceImage,
  sourceRole,
}: FieldRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink">{label}</span>
        {detected ? (
          <span className="text-xs font-mono text-ink-muted">
            {confidence !== null ? `ocr conf. ${confidence.toFixed(0)}%` : ""}
          </span>
        ) : (
          <span className="text-xs font-mono text-status-unknown uppercase tracking-wide">
            Not detected
          </span>
        )}
      </div>

      {detected ? (
        <div className="bg-bg border border-border rounded px-3 py-2 space-y-1">
          <div className="text-sm text-ink font-medium">{displayValue}</div>
          {rawText && (
            <div className="text-xs font-mono text-ink-muted truncate">
              &ldquo;{rawText}&rdquo; — {sourceImage} ({sourceRole})
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-ink-muted">
          No matching text found in submitted images.
        </div>
      )}
    </div>
  );
}