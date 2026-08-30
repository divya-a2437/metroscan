import type { ImageRole } from "@/components/scanner/ImageUploader";
import type { ProductDeclaration } from "@/lib/extraction/schema";

/**
 * IMPORTANT — what this module is and isn't:
 *
 * This is an evidence-COVERAGE heuristic, not a legal placement rule. It
 * does not claim that any declaration definitely exists on a particular
 * package panel — it only reflects common packaging conventions (a
 * declaration "commonly appears on" certain panels) to help distinguish
 * two very different situations that look identical from OCR alone:
 *
 *   1. "This declaration was not detected in the images we were given."
 *   2. "The images we were given may not even show the part of the
 *      package where this declaration would normally appear."
 *
 * A missing FRONT/BACK-only declaration that is commonly found on a SIDE
 * or BOTTOM panel is NOT proof that the package omits it — it may simply
 * mean the wrong (or too few) photos were submitted. This module never
 * upgrades or downgrades an existing RuleResult status; it only adds
 * context alongside the existing REVIEW/NOT_CHECKED result.
 */

export type CoverageState = "ADEQUATE" | "LIMITED" | "INSUFFICIENT";

export interface AffectedField {
  /** Human-readable field label, matching DECLARATION_FIELD_ORDER wording where possible. */
  field: string;
  reason: string;
  /** Panels commonly associated with this declaration that were NOT submitted. */
  recommendedRoles: ImageRole[];
}

export interface CoverageAssessment {
  submittedRoles: ImageRole[];
  missingRoles: ImageRole[];
  state: CoverageState;
  summary: string;
  affectedFields: AffectedField[];
}

/**
 * The five package "panels" this heuristic reasons about. "unspecified"
 * is deliberately excluded — an image with no declared role provides no
 * coverage signal either way, so it's neither counted as submitted nor
 * treated as a gap.
 */
const TRACKED_ROLES: ImageRole[] = ["front", "back", "side", "top", "bottom"];

/**
 * Conservative field -> commonly-relevant-panel mapping. These are
 * evidence-coverage heuristics based on common packaging conventions,
 * NOT statutory placement requirements — MetroScan does not verify or
 * assert where a declaration is legally required to be printed.
 */
const FIELD_COVERAGE_EXPECTATIONS: Array<{
  field: keyof ProductDeclaration;
  label: string;
  relevantRoles: ImageRole[];
}> = [
  { field: "product_name", label: "Product / Generic Name", relevantRoles: ["front", "back"] },
  { field: "net_quantity", label: "Net Quantity", relevantRoles: ["front", "back", "side"] },
  { field: "mrp", label: "MRP", relevantRoles: ["back", "side", "bottom"] },
  { field: "manufacturer", label: "Manufacturer / Packer / Importer", relevantRoles: ["back", "side"] },
  { field: "address", label: "Address", relevantRoles: ["back", "side"] },
  { field: "consumer_care", label: "Consumer Care", relevantRoles: ["back", "side"] },
  { field: "manufacturing_date", label: "Manufacturing Date", relevantRoles: ["back", "side", "bottom"] },
  { field: "packing_date", label: "Packing Date", relevantRoles: ["back", "side", "bottom"] },
  { field: "best_before", label: "Best Before", relevantRoles: ["back", "side", "bottom"] },
  { field: "use_by", label: "Use By", relevantRoles: ["back", "side", "bottom"] },
  { field: "country_of_origin", label: "Country of Origin", relevantRoles: ["back", "side"] },
  { field: "unit_sale_price", label: "Unit Sale Price", relevantRoles: ["back", "side"] },
];

/** Returns whether a given declaration field currently has a detected value, without altering any data. */
function isDetected(declaration: ProductDeclaration, field: keyof ProductDeclaration): boolean {
  if (field === "net_quantity") {
    const f = declaration.net_quantity;
    return f.value !== null && f.unit !== null;
  }
  const f = declaration[field];
  return f.value !== null && f.value !== "";
}

/**
 * Assesses whether the submitted image roles provide adequate evidence
 * coverage, given which declaration fields were and weren't detected.
 * Duplicate images of the same role (e.g. "front.jpg" and "front2.jpg")
 * count as a single submitted role — coverage is about which PANELS were
 * shown, not how many photos were taken.
 */
export function assessImageCoverage(
  roles: ImageRole[],
  declaration: ProductDeclaration
): CoverageAssessment {
  const submittedRoles = TRACKED_ROLES.filter((r) => roles.includes(r));
  const missingRoles = TRACKED_ROLES.filter((r) => !roles.includes(r));

  const affectedFields: AffectedField[] = [];

  for (const expectation of FIELD_COVERAGE_EXPECTATIONS) {
    if (isDetected(declaration, expectation.field)) continue;

    // Only flag this field as coverage-affected if at least one of its
    // commonly-relevant panels was NOT submitted. If every relevant panel
    // for this field WAS submitted and it's still not detected, that's a
    // straightforward "not detected in the evidence we have" case — not
    // a coverage gap — so it's correctly left out of this list.
    const missingRelevantRoles = expectation.relevantRoles.filter((r) =>
      missingRoles.includes(r)
    );
    if (missingRelevantRoles.length === 0) continue;

    affectedFields.push({
      field: expectation.label,
      reason: `${expectation.label} was not detected in the submitted images. This declaration is commonly printed on panels that were not provided, so this may reflect incomplete evidence rather than an actual omission.`,
      recommendedRoles: missingRelevantRoles,
    });
  }

  // Qualitative states only — no numeric "coverage score" is computed or
  // implied anywhere in this module.
  let state: CoverageState;
  if (submittedRoles.length === 0) {
    state = "INSUFFICIENT";
  } else if (affectedFields.length === 0) {
    state = "ADEQUATE";
  } else if (submittedRoles.length === 1) {
    // A single panel submitted, with gaps remaining, is thin enough
    // evidence that "limited" understates it.
    state = "INSUFFICIENT";
  } else {
    state = "LIMITED";
  }

  const roleLabel = (r: ImageRole) => r.toUpperCase();
  let summary: string;
  if (state === "ADEQUATE") {
    summary =
      submittedRoles.length > 0
        ? `${submittedRoles.length} package panel${submittedRoles.length !== 1 ? "s" : ""} submitted (${submittedRoles.map(roleLabel).join(", ")}). No undetected declarations appear linked to missing panel coverage.`
        : "No image roles were assigned, so panel coverage could not be evaluated.";
  } else if (state === "INSUFFICIENT" && submittedRoles.length === 0) {
    summary =
      "No package panels were assigned a role, so evidence coverage could not be meaningfully assessed. Assign roles (front/back/side/top/bottom) to submitted images for a coverage assessment.";
  } else if (state === "INSUFFICIENT") {
    summary = `Only ${submittedRoles.length} package panel submitted (${submittedRoles.map(roleLabel).join(", ")}). ${affectedFields.length} declaration check${affectedFields.length !== 1 ? "s" : ""} may be affected by this narrow coverage — additional panels are recommended before treating these as confirmed omissions.`;
  } else {
    summary = `${submittedRoles.length} package panel${submittedRoles.length !== 1 ? "s" : ""} submitted (${submittedRoles.map(roleLabel).join(", ")}). ${affectedFields.length} declaration check${affectedFields.length !== 1 ? "s" : ""} may be affected by incomplete image coverage.`;
  }

  return { submittedRoles, missingRoles, state, summary, affectedFields };
}