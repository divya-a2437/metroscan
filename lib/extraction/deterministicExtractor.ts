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
  const netQtyMatch = findFirstMatch(
    lines,
    /(?:net\s*(?:qty|quantity|wt|weight)?)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|grams?|ml|l|lt|ltr|litres?|liters?)\b/i
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
  const mrpMatch = findFirstMatch(
    lines,
    /m\.?r\.?p\.?[^\d₹]{0,15}(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i
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
  // just because it happened to be the first non-numeric line encountered.
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
  const productNameLine = candidateLines.find(
    (l) =>
      l.text.length >= 3 &&
      !/^\d+$/.test(l.text) &&
      !usedRawTexts.has(l.text) &&
      !looksLikeCurrencyOrCode.test(l.text)
  );
  if (productNameLine) {
    declaration.product_name = {
      value: productNameLine.text,
      confidence: productNameLine.chunk.confidence,
      evidence: evidenceFor(productNameLine, productNameLine.text),
    };
  }

  return declaration;
}