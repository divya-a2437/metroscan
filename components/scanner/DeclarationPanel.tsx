"use client";

import { Cpu, Quote, Image as ImageIcon } from "lucide-react";
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

/** Returns whether a given field key currently has a detected value, without altering any data. */
function isDetected(declaration: ProductDeclaration, key: keyof ProductDeclaration): boolean {
  if (key === "net_quantity") {
    const field = declaration.net_quantity;
    return field.value !== null && field.unit !== null;
  }
  const field = declaration[key];
  return field.value !== null && field.value !== "";
}

/**
 * Renders extracted fields only — this panel makes no compliance judgment.
 * "Not detected" simply means the deterministic extractor found no match;
 * it is not a violation finding. That determination belongs to the rule
 * engine. Detection is intentionally shown with a neutral indicator, not
 * a pass/fail-style checkmark or color, to avoid implying a verdict here.
 */
export function DeclarationPanel({ declaration }: DeclarationPanelProps) {
  return (
    <div className="border border-border rounded bg-surface">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
          Extracted Declaration
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-ink border border-border rounded-full px-2 py-0.5">
          <Cpu className="w-3 h-3" />
          DETERMINISTIC
        </span>
      </div>

      {FIELD_GROUPS.map((group) => {
        const detectedCount = group.keys.filter((k) => isDetected(declaration, k)).length;
        return (
          <div key={group.title} className="border-b border-border last:border-b-0">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                {group.title}
              </span>
              <span className="text-[10px] font-mono text-ink-muted">
                {detectedCount}/{group.keys.length} detected
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 pb-4">
              {group.keys.map((key) => (
                <FieldCardForKey key={key} declaration={declaration} fieldKey={key} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FieldCardForKey({
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
      <FieldCard
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
    <FieldCard
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

interface FieldCardProps {
  label: string;
  detected: boolean;
  displayValue: string | null;
  confidence: number | null;
  rawText: string | null;
  sourceImage: string | null;
  sourceRole: string | null;
}

function FieldCard({
  label,
  detected,
  displayValue,
  confidence,
  rawText,
  sourceImage,
  sourceRole,
}: FieldCardProps) {
  return (
    <div className="rounded border border-border bg-bg/50 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            detected ? "bg-ink" : "bg-status-unknown/40"
          }`}
          aria-hidden
        />
        <span className="text-[11px] text-ink-muted uppercase tracking-wide">{label}</span>
      </div>

      {detected ? (
        <>
          <div className="text-sm font-medium text-ink mb-2">{displayValue}</div>

          {rawText && (
            <div className="flex items-start gap-1.5 text-[11px] font-mono text-ink-muted border-t border-border pt-2">
              <Quote className="w-3 h-3 shrink-0 mt-0.5" />
              <span className="truncate">{rawText}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-ink-muted mt-1.5">
            {sourceImage && (
              <span className="inline-flex items-center gap-1 truncate">
                <ImageIcon className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {sourceImage} · {sourceRole?.toUpperCase()}
                </span>
              </span>
            )}
            {confidence !== null && (
              <span className="shrink-0">{confidence.toFixed(0)}% OCR conf.</span>
            )}
          </div>
        </>
      ) : (
        <div className="text-xs text-ink-muted">
          Not detected — manual verification recommended.
        </div>
      )}
    </div>
  );
}