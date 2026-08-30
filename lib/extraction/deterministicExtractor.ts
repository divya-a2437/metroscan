import type { ImageRole } from "@/components/scanner/ImageUploader";
import {
  emptyDeclaration,
  type ExtractedField,
  type FieldEvidence,
  type OcrChunk,
  type ProductDeclaration,
} from "./schema";
import { normalizeUnit, parseAmount } from "./normalize";

/**
 * This is a deliberately simple, fully deterministic, regex/keyword-based
 * extractor. It exists so the pipeline (OCR -> structured data -> rule
 * engine) works end-to-end without depending on any AI/LLM provider.
 *
 * It is intentionally NOT the final extraction strategy — a future step can
 * swap in an AI-assisted extractor behind the same function signature
 * (chunks in, ProductDeclaration out) without touching the rule engine or
 * UI. Nothing here makes a legal/compliance judgment; it only locates text.
 */

interface Line {
  text: string;
  chunk: OcrChunk;
}

function toLines(chunks: OcrChunk[]): Line[] {
  const lines: Line[] = [];
  for (const chunk of chunks) {
    for (const rawLine of chunk.text.split(/\r?\n/)) {
      const text = rawLine.trim();
      if (text.length > 0) lines.push({ text, chunk });
    }
  }
  return lines;
}

function evidenceFor(line: Line, rawText: string): FieldEvidence {
  // Deterministic exact-text lookup only — the extractor's own line
  // splitting (chunk.text.split on newlines) and Tesseract's line-level
  // spatial records (chunk.lines) both come from the same underlying OCR
  // pass, so an exact trimmed-text match reliably pairs them. If no exact
  // match is found (chunk.lines absent, or any text discrepancy), spatial
  // data is simply omitted — no fuzzy/approximate matching is attempted.
  const spatial = line.chunk.lines?.find((l) => l.text === line.text) ?? null;
  return {
    rawText,
    sourceImage: line.chunk.fileName,
    sourceRole: line.chunk.role,
    spatial,
  };
}

/** Finds the first line matching `pattern`, returning the capture + evidence. */
function findFirstMatch(
  lines: Line[],
  pattern: RegExp
): { match: RegExpMatchArray; line: Line } | null {
  for (const line of lines) {
    const match = line.text.match(pattern);
    if (match) return { match, line };
  }
  return null;
}

function fieldFromPattern(lines: Line[], pattern: RegExp, group = 1): ExtractedField {
  const found = findFirstMatch(lines, pattern);
  if (!found) return { value: null, confidence: null, evidence: null };
  const value = found.match[group]?.trim() ?? null;
  if (!value) return { value: null, confidence: null, evidence: null };
  return {
    value,
    confidence: found.line.chunk.confidence,
    evidence: evidenceFor(found.line, found.line.text),
  };
}

const DATE_PATTERN = "(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}|[A-Za-z]{3,9}\\s?\\d{4})";

/**
 * Generic packaging marketing/claim vocabulary used only to DEPRIORITIZE
 * candidate lines when ranking product-name candidates — never to identify
 * or invent a product name. Deliberately brand-agnostic: no product or
 * company names appear here, only common claim/nutrition-panel wording
 * found across many packaged commodities.
 */
const MARKETING_OR_NUTRITION_KEYWORDS = [
  "no", "free", "real", "natural", "artificial", "source", "sources",
  "color", "colors", "colour", "colours", "flavor", "flavors", "flavour",
  "flavours", "gluten", "organic", "trans fat", "cholesterol",
  "preservative", "preservatives", "healthy", "vitamin", "ingredient",
  "ingredients", "made with", "contains", "nutrition", "facts", "serving",
  "calories", "sodium", "protein", "fiber", "sugar", "fat", "carbohydrate",
  "carbohydrates",
];

/** Counts how many marketing/nutrition keywords appear as whole words in `text`. */
function marketingKeywordHitCount(text: string): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const keyword of MARKETING_OR_NUTRITION_KEYWORDS) {
    const escaped = keyword.replace(/\s+/g, "\\s+");
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");
    if (pattern.test(lower)) hits++;
  }
  return hits;
}

/**
 * Scores a candidate line for how plausible it is as a product/brand name.
 * Returns null for lines that are hard-excluded (mostly non-alphabetic —
 * i.e. OCR noise, codes, or bare numbers/symbols like "193!"). This is a
 * ranking heuristic only: it never corrects OCR text or invents a value —
 * it only decides which already-present OCR line is the least-bad
 * candidate among what was actually detected.
 */
function scoreProductNameCandidate(line: Line): number | null {
  const text = line.text;
  const letterCount = (text.match(/[A-Za-z]/g) ?? []).length;
  const alphabeticRatio = text.length > 0 ? letterCount / text.length : 0;

  // Hard exclusion: mostly non-alphabetic lines are never a plausible
  // product/brand name (garbled fragments, codes, bare numbers/symbols).
  if (alphabeticRatio < 0.6) return null;

  let score = 100;

  // Penalize marketing-claim / nutrition-panel vocabulary heavily — these
  // are common on packaging but are claims/facts, not the product name.
  score -= marketingKeywordHitCount(text) * 40;

  // Smaller continuous penalty for partial noise even above the hard cutoff.
  score -= (1 - alphabeticRatio) * 20;

  // Percentage signs are a strong signal of a nutrition/claim line.
  if (/%/.test(text)) score -= 30;

  // Mild length preference: brand/flavor names are usually short; long
  // lines are more likely full marketing sentences.
  if (text.length > 25) score -= 15;
  else if (text.length <= 15) score += 10;

  // Reward visual prominence when spatial data is available — bigger text
  // is more likely to be the brand/product name than fine print. Capped so
  // one very large line can't completely dominate the ranking on its own.
  const spatialMatch = line.chunk.lines?.find((l) => l.text === text);
  if (spatialMatch?.rowHeight != null) {
    score += Math.min(spatialMatch.rowHeight, 60) * 0.5;
  }

  return score;
}

export function extractDeclaration(chunks: OcrChunk[]): ProductDeclaration {
  const declaration = emptyDeclaration();
  if (chunks.length === 0) return declaration;

  const lines = toLines(chunks);

  // --- Manufacturer / Packer / Importer -----------------------------------
  declaration.manufacturer = fieldFromPattern(
    lines,
    /(?:manufactured|mfd|mfg)\.?\s*by\s*[:\-]?\s*(.+)/i
  );
  declaration.packer = fieldFromPattern(lines, /packed\s*by\s*[:\-]?\s*(.+)/i);
  declaration.importer = fieldFromPattern(lines, /imported\s*by\s*[:\-]?\s*(.+)/i);

  // "Marketed by" is common on Indian FMCG labels and often doubles as the
  // packer/manufacturer declaration when no other keyword is present.
  if (!declaration.manufacturer.value && !declaration.packer.value) {
    const marketed = fieldFromPattern(lines, /marketed\s*by\s*[:\-]?\s*(.+)/i);
    if (marketed.value) declaration.manufacturer = marketed;
  }

  // --- Address --------------------------------------------------------------
  declaration.address = fieldFromPattern(
    lines,
    /(?:address|regd\.?\s*office)\s*[:\-]?\s*(.+)/i
  );
  // Fallback: a 6-digit Indian PIN code preceded by a comma is a strong
  // address signal (Indian addresses are typically comma-segmented, e.g.
  // "...Road, Industrial Area, 400001"). Requiring the comma avoids
  // wrongly capturing a standalone batch/lot/barcode number as an address.
  if (!declaration.address.value) {
    declaration.address = fieldFromPattern(lines, /(.*,.*\b\d{6}\b.*)/);
  }

  // --- Net Quantity -----------------------------------------------------
  // The optional "\.?" after the abbreviation group handles labels that
  // punctuate the abbreviation (e.g. "Net Wt. 52 g").
  const netQtyMatch = findFirstMatch(
    lines,
    /(?:net\s*(?:qty|quantity|wt|weight)?\.?)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|grams?|ml|l|lt|ltr|litres?|liters?)\b/i
  );
  if (netQtyMatch) {
    const value = parseAmount(netQtyMatch.match[1]);
    const unit = normalizeUnit(netQtyMatch.match[2]);
    declaration.net_quantity = {
      value,
      unit,
      confidence: netQtyMatch.line.chunk.confidence,
      evidence: evidenceFor(netQtyMatch.line, netQtyMatch.line.text),
    };
  }

  // --- MRP -----------------------------------------------------------------
  // Keyword alternation accepts either the abbreviated "MRP"/"M.R.P." form
  // or the fully spelled-out "Maximum Retail Price" form.
  //
  // The gap between the keyword and the number is intentionally lazy
  // ({0,15}? rather than greedy {0,15}): a greedy gap would swallow a "-"
  // sitting directly before the digits as "junk" (since "-" is neither a
  // digit nor ₹), silently turning "MRP Rs. -1" into "1". A lazy gap tries
  // the shortest possible skip first, so when a minus sign is immediately
  // adjacent to the digits, the capture group gets first claim on it. The
  // "-?" is attached directly to the digit class with nothing in between,
  // so a hyphen used as a decorative separator (e.g. "MRP - Rs 45", with a
  // space/word before the number) is never mistaken for a sign — only a
  // hyphen touching the digits counts.
  const mrpMatch = findFirstMatch(
    lines,
    /(?:m\.?r\.?p\.?|maximum\s*retail\s*price)[^\d₹]{0,15}?(?:rs\.?|inr|₹)?\s*(-?[\d,]+(?:\.\d{1,2})?)/i
  );
  if (mrpMatch) {
    const value = parseAmount(mrpMatch.match[1]);
    declaration.mrp = {
      value: value !== null ? value.toString() : null,
      confidence: mrpMatch.line.chunk.confidence,
      evidence: evidenceFor(mrpMatch.line, mrpMatch.line.text),
    };
  }

  // --- Unit Sale Price -------------------------------------------------
  declaration.unit_sale_price = fieldFromPattern(
    lines,
    /unit\s*sale\s*price\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );

  // --- Dates -----------------------------------------------------------
  declaration.manufacturing_date = fieldFromPattern(
    lines,
    new RegExp(`(?:mfg|mfd|manufactured|packed\\s*on|pkd)\\.?\\s*(?:date)?\\s*[:\\-]?\\s*${DATE_PATTERN}`, "i")
  );
  declaration.packing_date = fieldFromPattern(
    lines,
    new RegExp(`(?:pkd|packing\\s*date|packed\\s*on)\\s*[:\\-]?\\s*${DATE_PATTERN}`, "i")
  );
  declaration.best_before = fieldFromPattern(
    lines,
    new RegExp(`best\\s*before\\s*[:\\-]?\\s*(${DATE_PATTERN}|\\d+\\s*(?:months?|days?|years?))`, "i")
  );
  declaration.use_by = fieldFromPattern(
    lines,
    new RegExp(`use\\s*by\\s*[:\\-]?\\s*(${DATE_PATTERN})`, "i")
  );

  // --- Country of Origin -------------------------------------------------
  declaration.country_of_origin = fieldFromPattern(
    lines,
    /country\s*of\s*origin\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{1,30})/i
  );

  // --- Consumer Care ----------------------------------------------------
  const careMatch = findFirstMatch(
    lines,
    /(?:consumer\s*care|customer\s*care)[^:\n]*[:\-]?\s*(.+)/i
  );
  if (careMatch) {
    declaration.consumer_care = {
      value: careMatch.match[1]?.trim() || careMatch.line.text,
      confidence: careMatch.line.chunk.confidence,
      evidence: evidenceFor(careMatch.line, careMatch.line.text),
    };
  } else {
    // Fallback: a bare email or Indian-format phone number, even without
    // an explicit "consumer care" label nearby.
    const contactMatch = findFirstMatch(
      lines,
      /([\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?91[\-\s]?)?[6-9]\d{9})/
    );
    if (contactMatch) {
      declaration.consumer_care = {
        value: contactMatch.match[1],
        confidence: contactMatch.line.chunk.confidence,
        evidence: evidenceFor(contactMatch.line, contactMatch.line.text),
      };
    }
  }

  // --- Generic Name ------------------------------------------------------
  declaration.generic_name = fieldFromPattern(
    lines,
    /generic\s*name\s*[:\-]?\s*(.+)/i
  );

  // --- Product Name (weakest heuristic — prefer the front image) ---------
  // Exclude any line already claimed as evidence by another field, so a
  // line like "MRP Rs. 45.00" can never be mistaken for the product name
  // just because it happened to be a qualifying line.
  const usedRawTexts = new Set<string>(
    [
      declaration.manufacturer.evidence,
      declaration.packer.evidence,
      declaration.importer.evidence,
      declaration.address.evidence,
      declaration.net_quantity.evidence,
      declaration.mrp.evidence,
      declaration.unit_sale_price.evidence,
      declaration.manufacturing_date.evidence,
      declaration.packing_date.evidence,
      declaration.best_before.evidence,
      declaration.use_by.evidence,
      declaration.country_of_origin.evidence,
      declaration.consumer_care.evidence,
      declaration.generic_name.evidence,
    ]
      .filter((e): e is FieldEvidence => e !== null)
      .map((e) => e.rawText)
  );

  // Extra safety net: skip lines that look like a currency amount even if
  // MRP parsing failed for some other reason — these should never be
  // mistaken for a product name.
  const looksLikeCurrencyOrCode = /₹|\brs\.?\s*\d|\bmrp\b/i;

  const frontLines = lines.filter((l) => l.chunk.role === ("front" as ImageRole));
  const candidateLines = frontLines.length > 0 ? frontLines : lines;

  const qualifyingLines = candidateLines.filter(
    (l) =>
      l.text.length >= 3 &&
      !/^\d+$/.test(l.text) &&
      !usedRawTexts.has(l.text) &&
      !looksLikeCurrencyOrCode.test(l.text)
  );

  // Rank ALL qualifying lines rather than taking the first one. This is
  // still fully deterministic (same inputs always produce the same
  // ranking and the same winner) and never invents text that isn't
  // present in the OCR output — it only chooses among what OCR actually
  // detected.
  const scoredCandidates = qualifyingLines
    .map((line) => ({ line, score: scoreProductNameCandidate(line) }))
    .filter((c): c is { line: Line; score: number } => c.score !== null)
    .sort((a, b) => b.score - a.score);

  const productNameLine = scoredCandidates[0]?.line;
  if (productNameLine) {
    declaration.product_name = {
      value: productNameLine.text,
      confidence: productNameLine.chunk.confidence,
      evidence: evidenceFor(productNameLine, productNameLine.text),
    };
  }

  return declaration;
}