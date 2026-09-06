import { GoogleGenAI } from "@google/genai";
import { emptyDeclaration, type ProductDeclaration } from "@/lib/extraction/schema";
import type { ImageRole } from "@/components/scanner/ImageUploader";

export const runtime = "nodejs";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

interface UploadedImageMetadata {
  id: string;
  fileName: string;
  role: ImageRole;
}

interface GeminiField {
  value?: string | number | null;
  unit?: string | null;
  confidence?: number | null;
  rawText?: string | null;
  sourceImage?: string | null;
  sourceRole?: ImageRole | null;
}

interface GeminiResult {
  images?: Array<{ id?: string; text?: string; confidence?: number | null }>;
  declaration?: Partial<Record<keyof ProductDeclaration, GeminiField>>;
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function toField(field: GeminiField | undefined) {
  const value = field?.value;
  if (value === null || value === undefined || String(value).trim() === "") {
    return { value: null, confidence: null, evidence: null };
  }

  return {
    value: String(value).trim(),
    confidence: clampConfidence(field?.confidence),
    evidence: field?.rawText
      ? {
          rawText: field.rawText,
          sourceImage: field.sourceImage ?? "unknown",
          sourceRole: field.sourceRole ?? "unspecified",
        }
      : null,
  };
}

function toDeclaration(result: GeminiResult): ProductDeclaration {
  const declaration = emptyDeclaration();
  const fields = result.declaration ?? {};

  for (const key of Object.keys(declaration) as Array<keyof ProductDeclaration>) {
    const field = fields[key];
    if (key === "net_quantity") {
      const value = typeof field?.value === "number" ? field.value : Number(field?.value);
      declaration.net_quantity = {
        value: Number.isFinite(value) ? value : null,
        unit: field?.unit ? String(field.unit).trim().toLowerCase() : null,
        confidence: clampConfidence(field?.confidence),
        evidence: field?.rawText
          ? {
              rawText: field.rawText,
              sourceImage: field.sourceImage ?? "unknown",
              sourceRole: field.sourceRole ?? "unspecified",
            }
          : null,
      };
    } else {
      declaration[key] = toField(field) as never;
    }
  }

  return declaration;
}

function parseJson(text: string): GeminiResult {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned) as GeminiResult;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const metadata = JSON.parse(String(formData.get("metadata") ?? "[]")) as UploadedImageMetadata[];
    const images = metadata.map((item) => ({ item, file: formData.get(item.id) })).filter(
      (entry): entry is { item: UploadedImageMetadata; file: File } => entry.file instanceof File
    );

    if (images.length === 0) {
      return Response.json({ error: "At least one image is required." }, { status: 400 });
    }

    const parts = await Promise.all(
      images.map(async ({ item, file }) => ({
        inlineData: {
          mimeType: file.type || "image/jpeg",
          data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        },
        item,
      }))
    );

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Extract packaged-commodity label declarations from these images. Return ONLY valid JSON with this shape:
{"images":[{"id":"...","text":"all readable label text","confidence":0-100}],"declaration":{"product_name":{"value":string|null,"confidence":0-100,"rawText":string|null,"sourceImage":string|null,"sourceRole":string|null},"generic_name":{},"manufacturer":{},"packer":{},"importer":{},"address":{},"net_quantity":{"value":number|null,"unit":string|null,"confidence":0-100,"rawText":string|null,"sourceImage":string|null,"sourceRole":string|null},"mrp":{},"manufacturing_date":{},"packing_date":{},"best_before":{},"use_by":{},"country_of_origin":{},"consumer_care":{},"unit_sale_price":{}}}
Use null when a declaration is not visible. Never infer or invent values. For every detected field, use the exact visible supporting line as rawText and the matching filename and role from this image manifest: ${JSON.stringify(metadata)}`,
            },
            ...parts.map(({ inlineData }) => ({ inlineData })),
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    const result = parseJson(response.text ?? "{}");
    const resultById = new Map((result.images ?? []).map((image) => [image.id, image]));
    return Response.json({
      declaration: toDeclaration(result),
      images: images.map(({ item }) => ({
        id: item.id,
        text: resultById.get(item.id)?.text ?? "",
        confidence: clampConfidence(resultById.get(item.id)?.confidence),
      })),
    });
  } catch (error) {
    console.error("Gemini extraction failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Gemini extraction failed." },
      { status: 502 }
    );
  }
}