/** Normalizes OCR unit spellings to a small canonical set. */
export function normalizeUnit(raw: string): string {
  const u = raw.trim().toLowerCase().replace(/\.$/, "");
  if (["g", "gm", "gms", "gram", "grams"].includes(u)) return "g";
  if (["kg", "kgs", "kilogram", "kilograms"].includes(u)) return "kg";
  if (["ml", "millilitre", "milliliter", "millilitres", "milliliters"].includes(u))
    return "ml";
  if (["l", "lt", "ltr", "litre", "liter", "litres", "liters"].includes(u)) return "l";
  return u;
}

/** Parses a numeric string that may contain commas (e.g. "1,200.50"). */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}
