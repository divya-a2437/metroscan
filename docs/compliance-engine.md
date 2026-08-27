# MetroScan — Compliance Rule Engine

## Purpose

Evaluates a structured `ProductDeclaration` (produced by the deterministic
extraction layer) against a small, prototype set of Legal Metrology
declaration requirements. This engine makes **every** compliance
determination — OCR and extraction never do.

**No AI/LLM is used anywhere in this engine.** Every rule is a plain
TypeScript function: `(declaration: ProductDeclaration) => RuleResult`.

## Scope Disclaimer

This is a **prototype rule set covering 7 declaration categories** — it is
not a complete implementation of the Legal Metrology (Packaged
Commodities) Rules, 2011 (with amendments). Font-size thresholds, exact
statutory penalty provisions, and category-specific exemptions are **not**
implemented and should be treated as **LEGAL SOURCE VERIFICATION
REQUIRED** if this prototype were ever extended toward production use.

## Statuses

| Status | Meaning |
|---|---|
| `PASS` | A valid-looking declaration was found for this requirement. |
| `FAIL` | A declaration was found but is malformed/invalid, or the evidence is sufficient to establish non-compliance. |
| `REVIEW` | The field is missing or ambiguous — a human must check the physical package, since OCR/extraction can miss text that genuinely exists on the label. |
| `NOT_CHECKED` | Applicability itself could not be established from available data (e.g. country-of-origin only applies to imported goods, and there is no reliable signal either way). |

The engine deliberately never conflates **"not detected"** with
**"illegal"** — missing evidence defaults to `REVIEW`, not `FAIL`, unless
the extracted value is itself invalid.

## Rule Set (`lib/rules/packagedCommodityRules.ts`)

| Rule ID | Title | PASS condition | FAIL condition | REVIEW / NOT_CHECKED condition |
|---|---|---|---|---|
| **PC-001** | Product / Generic Name | `product_name` or `generic_name` detected | — | Neither detected → REVIEW |
| **PC-002** | Manufacturer / Packer / Importer | At least one of the three detected | — | None detected → REVIEW |
| **PC-003** | Address | `address` detected | — | Not detected → REVIEW |
| **PC-004** | Net Quantity | Value + recognized unit (`g`, `kg`, `ml`, `l`) detected | Value detected but unit missing/unrecognized | No value detected → REVIEW |
| **PC-005** | Maximum Retail Price (MRP) | Value detected and is a valid positive number | Value detected but not a valid positive number | Not detected → REVIEW |
| **PC-006** | Consumer Care Details | `consumer_care` detected | — | Not detected → REVIEW |
| **PC-007** | Country of Origin | `country_of_origin` detected | — | Importer detected but no origin → REVIEW; no importer signal at all → **NOT_CHECKED** (applicability itself unknown) |

## Overall Status Aggregation (`lib/rules/evaluateCompliance.ts`)
if any rule FAIL → overallStatus = FAIL
else if any rule REVIEW → overallStatus = REVIEW
else → overallStatus = PASS

`NOT_CHECKED` results never affect the overall status — they represent
"this requirement's applicability could not be determined," not a pass or
a problem.

## RuleResult Shape

```typescript
interface RuleResult {
  ruleId: string;
  title: string;
  field: string;
  status: "PASS" | "FAIL" | "REVIEW" | "NOT_CHECKED";
  message: string;
  evidence: FieldEvidence | null;      // { rawText, sourceImage, sourceRole }
  severity: "HIGH" | "MEDIUM" | "LOW";
  detectedValue?: string | null;       // populated only when a concrete value drove the decision
  confidence?: number | null;          // OCR confidence of the source image, not a legal-certainty score
}
```

`confidence` is always **OCR confidence**, never a measure of legal
correctness — this distinction is preserved throughout the UI and the
clipboard summary text to avoid implying that detection equals
compliance.

## Extending the Rule Set

To add a rule: write a new `(d: ProductDeclaration) => RuleResult`
function in `packagedCommodityRules.ts` and add it to the
`PACKAGED_COMMODITY_RULES` array. No changes to `evaluateCompliance.ts`,
the extraction layer, or the UI are required — this separation was a
deliberate architectural choice from the start.