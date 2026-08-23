import type { ProductDeclaration } from "@/lib/extraction/schema";
import type { RuleResult } from "./types";

/**
 * A small, prototype rule set covering 7 declaration categories relevant
 * to Legal Metrology (Packaged Commodities) screening. This is NOT a
 * complete implementation of every statutory requirement — it exists to
 * demonstrate the OCR -> extraction -> deterministic rule engine pipeline
 * for the SIH prototype. Every rule here is deterministic: no AI/LLM call
 * is involved in producing PASS/FAIL/REVIEW.
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
  };
}

/** Rule PC-004 — Net quantity with a recognized unit. */
function evaluateNetQuantity(d: ProductDeclaration): RuleResult {
  const { value, unit, evidence } = d.net_quantity;

  if (value !== null && unit !== null && RECOGNIZED_UNITS.includes(unit)) {
    return {
      ruleId: "PC-004",
      title: "Net Quantity",
      field: "net_quantity",
      status: "PASS",
      message: `Net quantity detected as ${value} ${unit}.`,
      evidence,
      severity: "HIGH",
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
];