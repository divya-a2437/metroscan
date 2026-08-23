import type { ImageRole } from "@/components/scanner/ImageUploader";

/**
 * Points a declared field back to exactly where it came from, so the UI
 * (and later, evidence/bounding-box highlighting in Step 7) can show the
 * inspector "what was detected, where it was detected".
 */
export interface FieldEvidence {
  /** The exact OCR line the value was matched from. */
  rawText: string;
  /** Original filename of the source image. */
  sourceImage: string;
  /** Declared role of the source image (front/back/side/top/bottom/unspecified). */
  sourceRole: ImageRole;
}

/**
 * A single extracted declaration field. `confidence` here is the OCR
 * confidence of the source image the value was read from — it is NOT a
 * measure of legal correctness. This is intentionally just extracted data;
 * the rule engine (a later step) is what decides pass/fail/review.
 */
export interface ExtractedField {
  value: string | null;
  confidence: number | null;
  evidence: FieldEvidence | null;
}

/** Net quantity needs a value + unit pair rather than a single string. */
export interface NetQuantityField {
  value: number | null;
  unit: string | null;
  confidence: number | null;
  evidence: FieldEvidence | null;
}

export interface ProductDeclaration {
  product_name: ExtractedField;
  generic_name: ExtractedField;
  manufacturer: ExtractedField;
  packer: ExtractedField;
  importer: ExtractedField;
  address: ExtractedField;
  net_quantity: NetQuantityField;
  mrp: ExtractedField;
  manufacturing_date: ExtractedField;
  packing_date: ExtractedField;
  best_before: ExtractedField;
  use_by: ExtractedField;
  country_of_origin: ExtractedField;
  consumer_care: ExtractedField;
  unit_sale_price: ExtractedField;
}

/** One field key per declaration property, used for iterating in the UI. */
export const DECLARATION_FIELD_ORDER: Array<{
  key: keyof ProductDeclaration;
  label: string;
}> = [
  { key: "product_name", label: "Product Name" },
  { key: "generic_name", label: "Generic Name" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "packer", label: "Packer" },
  { key: "importer", label: "Importer" },
  { key: "address", label: "Address" },
  { key: "net_quantity", label: "Net Quantity" },
  { key: "mrp", label: "MRP" },
  { key: "manufacturing_date", label: "Manufacturing Date" },
  { key: "packing_date", label: "Packing Date" },
  { key: "best_before", label: "Best Before" },
  { key: "use_by", label: "Use By" },
  { key: "country_of_origin", label: "Country of Origin" },
  { key: "consumer_care", label: "Consumer Care" },
  { key: "unit_sale_price", label: "Unit Sale Price" },
];

/** Raw input to the extractor: one chunk of OCR output per source image. */
export interface OcrChunk {
  imageId: string;
  fileName: string;
  role: ImageRole;
  text: string;
  confidence: number;
}

function emptyField(): ExtractedField {
  return { value: null, confidence: null, evidence: null };
}

export function emptyDeclaration(): ProductDeclaration {
  return {
    product_name: emptyField(),
    generic_name: emptyField(),
    manufacturer: emptyField(),
    packer: emptyField(),
    importer: emptyField(),
    address: emptyField(),
    net_quantity: { value: null, unit: null, confidence: null, evidence: null },
    mrp: emptyField(),
    manufacturing_date: emptyField(),
    packing_date: emptyField(),
    best_before: emptyField(),
    use_by: emptyField(),
    country_of_origin: emptyField(),
    consumer_care: emptyField(),
    unit_sale_price: emptyField(),
  };
}