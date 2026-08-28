"use client";

import type { ProductDeclaration } from "@/lib/extraction/schema";
import { DECLARATION_FIELD_ORDER } from "@/lib/extraction/schema";

interface DeclarationPanelProps {
  declaration: ProductDeclaration;
}

/** Field grouping purely for presentation — does not change extraction logic or data. */
const FIELD_GROUPS: Array<{ title: string; keys: Array<keyof ProductDeclaration> }> = [
  { title: "Product", keys: ["product_name", "generic_name", "net_quantity"] },
  { title: "Responsible Entity", keys: ["manufacturer", "packer", "importer", "address"] },
  { title: "Pricing", keys: ["mrp", "unit_sale_price"] },
  {
    title: "Dates",
    keys: ["manufacturing_date", "packing_date", "best_before", "use_by"],
  },
  { title: "Consumer Information", keys: ["consumer_care", "country_of_origin"] },
];

const LABELS: Record<keyof ProductDeclaration, string> = Object.fromEntries(
  DECLARATION_FIELD_ORDER.map(({ key, label }) => [key, label])
) as Record<keyof ProductDeclaration, string>;

/**
 * Renders extracted fields only — this panel makes no compliance judgment.
 * "Not detected" simply means the deterministic extractor found no match;
 * it is not a violation finding. That determination belongs to the rule
 * engine.
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

      {FIELD_GROUPS.map((group) => (
        <div key={group.title} className="border-b border-border last:border-b-0">
          <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
            {group.title}
          </div>
          <ul className="divide-y divide-border">
            {group.keys.map((key) => (
              <li key={key} className="px-4 py-3">
                <FieldRowForKey declaration={declaration} fieldKey={key} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FieldRowForKey({
  declaration,
  fieldKey,
}: {
  declaration: ProductDeclaration;
  fieldKey: keyof ProductDeclaration;
}) {
  const label = LABELS[fieldKey];

  if (fieldKey === "net_quantity") {
    const field = declaration.net_quantity;
    const detected = field.value !== null && field.unit !== null;
    return (
      <FieldRow
        label={label}
        detected={detected}
        displayValue={detected ? `${field.value} ${field.unit}` : null}
        confidence={field.confidence}
        rawText={field.evidence?.rawText ?? null}
        sourceImage={field.evidence?.sourceImage ?? null}
        sourceRole={field.evidence?.sourceRole ?? null}
      />
    );
  }

  const field = declaration[fieldKey];
  const detected = field.value !== null && field.value !== "";
  return (
    <FieldRow
      label={label}
      detected={detected}
      displayValue={field.value}
      confidence={field.confidence}
      rawText={field.evidence?.rawText ?? null}
      sourceImage={field.evidence?.sourceImage ?? null}
      sourceRole={field.evidence?.sourceRole ?? null}
    />
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
          Not detected — manual verification recommended.
        </div>
      )}
    </div>
  );
}