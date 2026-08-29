import type { ExtractedField, ProductDeclaration } from "@/lib/extraction/schema";
import type { RuleResult } from "./types";

/**
 * A prototype rule set covering declaration categories relevant to Legal
 * Metrology (Packaged Commodities) screening. This is NOT a complete
 * implementation of every statutory requirement — it exists to demonstrate
 * the OCR -> extraction -> deterministic rule engine pipeline for the SIH
 * prototype. Every rule here is deterministic: no AI/LLM call is involved
 * in producing PASS/FAIL/REVIEW/NOT_CHECKED.
 *
 * Units considered valid for net quantity match the canonical set produced
 * by lib/extraction/normalize.ts (normalizeUnit): g, kg, ml, l.
 */
const RECOGNIZED_UNITS = ["g", "kg", "ml", "l"];

/** Rule PC-001 — Product / generic name declaration. */
function evaluateProductName(d: ProductDeclaration): RuleResult {
  const nameField = d.product_name.value ? d.product_name : d.generic_name;

  if (nameField.value) {
    return {
      ruleId: "PC-001",
      title: "Product / Generic Name",
      field: "product_name",
      status: "PASS",
      message: "A product or generic name was detected on the package.",
      evidence: nameField.evidence,
      severity: "MEDIUM",
      detectedValue: nameField.value,
      confidence: nameField.confidence,
      category: "DECLARATION",
    };
  }

  return {
    ruleId: "PC-001",
    title: "Product / Generic Name",
    field: "product_name",
    status: "REVIEW",
    message:
      "No product or generic name was detected in the submitted images. This may be an OCR/image-coverage limitation rather than an actual omission — manual verification is recommended.",
    evidence: null,
    severity: "MEDIUM",
    category: "DECLARATION",
  };
}

/** Rule PC-002 — Manufacturer / Packer / Importer declaration. */
function evaluateResponsibleEntity(d: ProductDeclaration): RuleResult {
  const candidates: Array<{ label: string; field: typeof d.manufacturer }> = [
    { label: "manufacturer", field: d.manufacturer },
    { label: "packer", field: d.packer },
    { label: "importer", field: d.importer },
  ];
  const found = candidates.find((c) => c.field.value);

  if (found) {
    return {
      ruleId: "PC-002",
      title: "Manufacturer / Packer / Importer",
      field: "manufacturer",
      status: "PASS",
      message: `A responsible entity was identified (${found.label}: "${found.field.value}").`,
      evidence: found.field.evidence,
      severity: "HIGH",
      detectedValue: found.field.value,
      confidence: found.field.confidence,
      category: "DECLARATION",
    };
  }

  return {
    ruleId: "PC-002",
    title: "Manufacturer / Packer / Importer",
    field: "manufacturer",
    status: "REVIEW",
    message:
      "No manufacturer, packer, or importer declaration was detected. At least one is expected on a compliant package — verify manually before treating this as a violation.",
    evidence: null,
    severity: "HIGH",
    category: "DECLARATION",
  };
}

/** Rule PC-003 — Address of the responsible entity. */
function evaluateAddress(d: ProductDeclaration): RuleResult {
  if (d.address.value) {
    return {
      ruleId: "PC-003",
      title: "Address",
      field: "address",
      status: "PASS",
      message: "An address was detected on the package.",
      evidence: d.address.evidence,
      severity: "MEDIUM",
      detectedValue: d.address.value,
      confidence: d.address.confidence,
      category: "DECLARATION",
    };
  }

  return {
    ruleId: "PC-003",
    title: "Address",
    field: "address",
    status: "REVIEW",
    message:
      "No address was detected in the submitted images. Manual verification recommended.",
    evidence: null,
    severity: "MEDIUM",
    category: "DECLARATION",
  };
}

/** Rule PC-004 — Net quantity with a recognized unit. */
function evaluateNetQuantity(d: ProductDeclaration): RuleResult {
  const { value, unit, confidence, evidence } = d.net_quantity;

  if (value !== null && unit !== null && RECOGNIZED_UNITS.includes(unit)) {
    return {
      ruleId: "PC-004",
      title: "Net Quantity",
      field: "net_quantity",
      status: "PASS",
      message: `Net quantity detected as ${value} ${unit}.`,
      evidence,
      severity: "HIGH",
      detectedValue: `${value} ${unit}`,
      confidence,
      category: "VALUE",
    };
  }

  if (value !== null) {
    return {
      ruleId: "PC-004",
      title: "Net Quantity",
      field: "net_quantity",
      status: "FAIL",
      message: `A net quantity value (${value}) was detected but its unit ("${unit ?? "none"}") is missing or not a recognized unit of measure.`,
      evidence,
      severity: "HIGH",
      detectedValue: `${value} ${unit ?? "(no unit)"}`,
      confidence,
      category: "VALUE",
    };
  }

  return {
    ruleId: "PC-004",
    title: "Net Quantity",
    field: "net_quantity",
    status: "REVIEW",
    message: "No net quantity declaration was detected. Manual verification recommended.",
    evidence: null,
    severity: "HIGH",
    category: "VALUE",
  };
}

/** Rule PC-005 — MRP with a valid positive value. */
function evaluateMrp(d: ProductDeclaration): RuleResult {
  if (d.mrp.value !== null) {
    const numeric = Number.parseFloat(d.mrp.value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return {
        ruleId: "PC-005",
        title: "Maximum Retail Price (MRP)",
        field: "mrp",
        status: "PASS",
        message: `MRP detected as a valid positive value (${numeric}).`,
        evidence: d.mrp.evidence,
        severity: "HIGH",
        detectedValue: d.mrp.value,
        confidence: d.mrp.confidence,
        category: "VALUE",
      };
    }
    return {
      ruleId: "PC-005",
      title: "Maximum Retail Price (MRP)",
      field: "mrp",
      status: "FAIL",
      message: `MRP was detected ("${d.mrp.value}") but is not a valid positive number.`,
      evidence: d.mrp.evidence,
      severity: "HIGH",
      detectedValue: d.mrp.value,
      confidence: d.mrp.confidence,
      category: "VALUE",
    };
  }

  return {
    ruleId: "PC-005",
    title: "Maximum Retail Price (MRP)",
    field: "mrp",
    status: "REVIEW",
    message: "No MRP declaration was detected. Manual verification recommended.",
    evidence: null,
    severity: "HIGH",
    category: "VALUE",
  };
}

/** Rule PC-006 — Consumer care details. */
function evaluateConsumerCare(d: ProductDeclaration): RuleResult {
  if (d.consumer_care.value) {
    return {
      ruleId: "PC-006",
      title: "Consumer Care Details",
      field: "consumer_care",
      status: "PASS",
      message: "Consumer care contact details were detected on the package.",
      evidence: d.consumer_care.evidence,
      severity: "MEDIUM",
      detectedValue: d.consumer_care.value,
      confidence: d.consumer_care.confidence,
      category: "DECLARATION",
    };
  }

  return {
    ruleId: "PC-006",
    title: "Consumer Care Details",
    field: "consumer_care",
    status: "REVIEW",
    message:
      "No consumer care contact details (phone/email) were detected. Manual verification recommended.",
    evidence: null,
    severity: "MEDIUM",
    category: "DECLARATION",
  };
}

/**
 * Rule PC-007 — Country of origin (applicable to imported products only).
 *
 * Applicability itself is uncertain from OCR text alone, so this rule is
 * deliberately conservative: it only escalates to REVIEW when there is a
 * positive signal (an importer declaration) suggesting the requirement
 * may apply, and returns NOT_CHECKED when applicability cannot be
 * established at all — it never asserts a FAIL based on inferred
 * applicability alone.
 */
function evaluateCountryOfOrigin(d: ProductDeclaration): RuleResult {
  const importerDeclared = Boolean(d.importer.value);

  if (d.country_of_origin.value) {
    return {
      ruleId: "PC-007",
      title: "Country of Origin",
      field: "country_of_origin",
      status: "PASS",
      message: `Country of origin detected: "${d.country_of_origin.value}".`,
      evidence: d.country_of_origin.evidence,
      severity: "MEDIUM",
      detectedValue: d.country_of_origin.value,
      confidence: d.country_of_origin.confidence,
      category: "DECLARATION",
    };
  }

  if (importerDeclared) {
    return {
      ruleId: "PC-007",
      title: "Country of Origin",
      field: "country_of_origin",
      status: "REVIEW",
      message:
        "An importer declaration was detected, which suggests this may be an imported product requiring a country-of-origin declaration — but no country of origin was found. Manual verification recommended.",
      evidence: d.importer.evidence,
      severity: "MEDIUM",
      category: "DECLARATION",
    };
  }

  return {
    ruleId: "PC-007",
    title: "Country of Origin",
    field: "country_of_origin",
    status: "NOT_CHECKED",
    message:
      "Country of origin applies only to imported products. No importer declaration was detected, so applicability of this requirement could not be established from the available data.",
    evidence: null,
    severity: "LOW",
    category: "DECLARATION",
  };
}

/**
 * Checks whether a dd/mm/yyyy (or d-m-yy, d.m.yyyy, etc.) date string is
 * calendrically plausible (month 1-12, day within that month's range).
 * Returns true for any value that doesn't match this numeric pattern at
 * all (e.g. "January 2026" or "6 months") — those formats aren't
 * validated this way, so they're treated as structurally acceptable
 * rather than penalized for a check that doesn't apply to them. This is
 * a deterministic, format-level plausibility check only — it does NOT
 * verify that the printed date is actually correct/true for this product.
 */
function isPlausibleNumericDate(raw: string): boolean {
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return true;
  const day = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

/**
 * Shared logic for the four single-date-field rules below (PC-008/009 for
 * a general date-of-origin expectation, PC-010/011 for shelf-life fields
 * whose applicability is category-dependent). `PASS` here means "a date
 * was detected and is calendrically plausible" — it explicitly does NOT
 * mean the printed date has been independently verified as legally
 * accurate, which this system has no way to confirm. `FAIL` is reserved
 * for a detected value that is structurally impossible (e.g. month 13).
 */
function evaluateDateField(
  field: ExtractedField,
  opts: { ruleId: string; title: string; fieldKey: string; missingStatus: "REVIEW" | "NOT_CHECKED"; missingMessage: string }
): RuleResult {
  if (field.value) {
    if (!isPlausibleNumericDate(field.value)) {
      return {
        ruleId: opts.ruleId,
        title: opts.title,
        field: opts.fieldKey,
        status: "FAIL",
        message: `A date value ("${field.value}") was detected but is not a calendrically valid date.`,
        evidence: field.evidence,
        severity: "MEDIUM",
        detectedValue: field.value,
        confidence: field.confidence,
        category: "DECLARATION",
      };
    }
    return {
      ruleId: opts.ruleId,
      title: opts.title,
      field: opts.fieldKey,
      status: "PASS",
      message:
        "A date was detected and is structurally valid. This confirms presence and plausible format only — it is not an independent verification that the printed date is accurate.",
      evidence: field.evidence,
      severity: "MEDIUM",
      detectedValue: field.value,
      confidence: field.confidence,
      category: "DECLARATION",
    };
  }

  return {
    ruleId: opts.ruleId,
    title: opts.title,
    field: opts.fieldKey,
    status: opts.missingStatus,
    message: opts.missingMessage,
    evidence: null,
    severity: "MEDIUM",
    category: "DECLARATION",
  };
}

/** Rule PC-008 — Manufacturing Date. */
function evaluateManufacturingDate(d: ProductDeclaration): RuleResult {
  return evaluateDateField(d.manufacturing_date, {
    ruleId: "PC-008",
    title: "Manufacturing Date",
    fieldKey: "manufacturing_date",
    missingStatus: "REVIEW",
    missingMessage:
      "No manufacturing date was detected in the submitted images. Manual verification recommended.",
  });
}

/** Rule PC-009 — Packing Date. */
function evaluatePackingDate(d: ProductDeclaration): RuleResult {
  return evaluateDateField(d.packing_date, {
    ruleId: "PC-009",
    title: "Packing Date",
    fieldKey: "packing_date",
    missingStatus: "REVIEW",
    missingMessage:
      "No packing date was detected in the submitted images. Note: many labels print only one of manufacturing date or packing date — check the Manufacturing Date result before treating this alone as an omission. Manual verification recommended.",
  });
}

/**
 * Rule PC-010 — Best Before.
 *
 * Applicability depends on whether the commodity is perishable, which
 * cannot be determined from OCR text alone — absence is therefore
 * NOT_CHECKED, never REVIEW or FAIL, per the documented convention for
 * applicability-uncertain requirements.
 */
function evaluateBestBefore(d: ProductDeclaration): RuleResult {
  return evaluateDateField(d.best_before, {
    ruleId: "PC-010",
    title: "Best Before",
    fieldKey: "best_before",
    missingStatus: "NOT_CHECKED",
    missingMessage:
      "Best Before declarations are only mandatory for certain commodity categories. Applicability could not be established from the available data, so this requirement is not evaluated.",
  });
}

/**
 * Rule PC-011 — Use By.
 *
 * Same applicability reasoning as PC-010 — category-dependent, not
 * determinable from available data, so absence is NOT_CHECKED.
 */
function evaluateUseBy(d: ProductDeclaration): RuleResult {
  return evaluateDateField(d.use_by, {
    ruleId: "PC-011",
    title: "Use By",
    fieldKey: "use_by",
    missingStatus: "NOT_CHECKED",
    missingMessage:
      "Use By declarations are only mandatory for certain commodity categories. Applicability could not be established from the available data, so this requirement is not evaluated.",
  });
}

/**
 * Rule PC-012 — Unit Sale Price.
 *
 * Only required for specific categories of packaged commodities (e.g.
 * goods sold by length or area); no signal exists to determine
 * applicability, so absence is NOT_CHECKED, never REVIEW/FAIL. A detected
 * value is still validated as a positive number.
 */
function evaluateUnitSalePrice(d: ProductDeclaration): RuleResult {
  if (d.unit_sale_price.value !== null) {
    const numeric = Number.parseFloat(d.unit_sale_price.value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return {
        ruleId: "PC-012",
        title: "Unit Sale Price",
        field: "unit_sale_price",
        status: "PASS",
        message: `Unit sale price detected as a valid positive value (${numeric}).`,
        evidence: d.unit_sale_price.evidence,
        severity: "LOW",
        detectedValue: d.unit_sale_price.value,
        confidence: d.unit_sale_price.confidence,
        category: "VALUE",
      };
    }
    return {
      ruleId: "PC-012",
      title: "Unit Sale Price",
      field: "unit_sale_price",
      status: "FAIL",
      message: `Unit sale price was detected ("${d.unit_sale_price.value}") but is not a valid positive number.`,
      evidence: d.unit_sale_price.evidence,
      severity: "LOW",
      detectedValue: d.unit_sale_price.value,
      confidence: d.unit_sale_price.confidence,
      category: "VALUE",
    };
  }

  return {
    ruleId: "PC-012",
    title: "Unit Sale Price",
    field: "unit_sale_price",
    status: "NOT_CHECKED",
    message:
      "Unit sale price is only required for specific categories of packaged commodities. Applicability could not be established from the available data, so this requirement is not evaluated.",
    evidence: null,
    severity: "LOW",
    category: "VALUE",
  };
}

/**
 * Rule PC-013 — Relative Text-Size / Readability Estimate.
 *
 * IMPORTANT: this is a RELATIVE comparison only. No physical DPI/scale
 * reference exists anywhere in this pipeline, so pixel rowHeight can never
 * be converted to an absolute font size in mm/pt, and this rule never
 * attempts to. It only compares a declaration's rowHeight against the
 * largest rowHeight found among other declarations on the SAME source
 * image (a reasonable proxy for "the most prominent text on this photo",
 * often the product name/brand). A declaration whose text is
 * disproportionately smaller than that reference is flagged for human
 * review — this is evidence for an inspector, not a legal determination.
 */
function evaluateRelativeReadability(d: ProductDeclaration): RuleResult {
  const samples: Array<{ label: string; rowHeight: number; evidence: NonNullable<ExtractedField["evidence"]> }> = [];

  const candidates: Array<{ label: string; field: ExtractedField }> = [
    { label: "Product Name", field: d.product_name },
    { label: d.manufacturer.value ? "Manufacturer" : d.packer.value ? "Packer" : "Importer", field: d.manufacturer.value ? d.manufacturer : d.packer.value ? d.packer : d.importer },
    { label: "MRP", field: d.mrp },
    { label: "Consumer Care", field: d.consumer_care },
  ];

  for (const c of candidates) {
    const rh = c.field.evidence?.spatial?.rowHeight;
    if (rh != null && c.field.evidence) {
      samples.push({ label: c.label, rowHeight: rh, evidence: c.field.evidence });
    }
  }
  const nqRowHeight = d.net_quantity.evidence?.spatial?.rowHeight;
  if (nqRowHeight != null && d.net_quantity.evidence) {
    samples.push({ label: "Net Quantity", rowHeight: nqRowHeight, evidence: d.net_quantity.evidence });
  }

  if (samples.length < 2) {
    return {
      ruleId: "PC-013",
      title: "Relative Text-Size / Readability Estimate",
      field: "readability",
      status: "NOT_CHECKED",
      message:
        "Insufficient spatial data was available to compare declaration text sizes. Relative readability could not be estimated. This is not an absolute physical font-size measurement.",
      evidence: null,
      severity: "LOW",
      category: "READABILITY",
    };
  }

  const maxRowHeight = Math.max(...samples.map((s) => s.rowHeight));
  const threshold = maxRowHeight * 0.4;
  const undersized = samples
    .filter((s) => s.rowHeight < threshold)
    .sort((a, b) => a.rowHeight - b.rowHeight);

  if (undersized.length > 0) {
    const worst = undersized[0];
    return {
      ruleId: "PC-013",
      title: "Relative Text-Size / Readability Estimate",
      field: "readability",
      status: "REVIEW",
      message: `${worst.label} text appears substantially smaller than the most prominent text detected on the same image. This is a relative text-size estimate only — not an absolute physical font-size measurement, and not a legal readability determination. Manual verification recommended.`,
      evidence: worst.evidence,
      severity: "LOW",
      detectedValue: `${worst.rowHeight}px vs ${maxRowHeight}px reference`,
      category: "READABILITY",
    };
  }

  return {
    ruleId: "PC-013",
    title: "Relative Text-Size / Readability Estimate",
    field: "readability",
    status: "PASS",
    message:
      "Declaration text sizes are broadly comparable to the most prominent text detected on the same image. This is a relative text-size estimate only — not an absolute physical font-size measurement.",
    evidence: null,
    severity: "LOW",
    category: "READABILITY",
  };
}

type RuleFn = (declaration: ProductDeclaration) => RuleResult;

export const PACKAGED_COMMODITY_RULES: RuleFn[] = [
  evaluateProductName,
  evaluateResponsibleEntity,
  evaluateAddress,
  evaluateNetQuantity,
  evaluateMrp,
  evaluateConsumerCare,
  evaluateCountryOfOrigin,
  evaluateManufacturingDate,
  evaluatePackingDate,
  evaluateBestBefore,
  evaluateUseBy,
  evaluateUnitSalePrice,
  evaluateRelativeReadability,
];