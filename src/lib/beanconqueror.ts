/**
 * Parser for Beanconqueror app JSON exports (BEANS section).
 *
 * Beanconqueror stores bean photos only as file-name references in the export
 * (no embedded data), so attachments cannot be recovered and are counted for
 * reporting only. Brews, mills, preparations and settings are intentionally
 * not imported — this tracker covers purchased bags.
 */

export type ImportedBean = {
  roaster: string;
  name: string;
  country: string | null;
  region: string | null;
  mix: string | null;
  variety: string | null;
  process: string | null;
  roastLevel: string | null;
  roastDate: string | null;
  purchaseDate: string | null;
  priceCents: number | null;
  weightGrams: number | null;
  rating: number | null;
  notes: string | null;
  tastingNotes: string | null;
  decaffeinated: boolean;
  sourceUuid: string | null;
};

export type BeanconquerorImport = {
  beans: ImportedBean[];
  photoCount: number;
  currency: string | null;
};

const ROAST_MAP: Record<string, string> = {
  LIGHT: "light",
  MEDIUM_LIGHT: "medium-light",
  MEDIUM: "medium",
  MEDIUM_DARK: "medium-dark",
  DARK: "dark",
};

/** Beanconqueror roast_range slider (0–5, 0.5 steps; 0 = unset) → our levels. */ 
function roastRangeToLevel(v: number | null): string | null {
  if (v === null || v <= 0) return null;
  if (v <= 1) return "light";
  if (v <= 2) return "medium-light";
  if (v <= 3) return "medium";
  if (v <= 4) return "medium-dark";
  return "dark";
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type BeanInfo = {
  country?: unknown;
  region?: unknown;
  variety?: unknown;
  processing?: unknown;
  percentage?: unknown;
};

/** Distinct non-empty strings joined with ", ". */
function joinUnique(...values: (string | null | undefined)[]): string {
  const parts = [...new Set(values.filter((v): v is string => typeof v === "string" && v.length > 0))];
  return parts.join(", ");
}

export function parseBeanconqueror(text: string): BeanconquerorImport {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON.");
  }
  if (typeof root !== "object" || root === null) {
    throw new Error("Not a Beanconqueror export (missing top-level object).");
  }
  const beans = (root as Record<string, unknown>).BEANS;
  if (!Array.isArray(beans)) {
    throw new Error("Not a Beanconqueror export (no BEANS array found).");
  }

  const settings = (root as Record<string, unknown>).SETTINGS;
  const currency = Array.isArray(settings) && typeof settings[0] === "object" && settings[0] !== null
    ? str((settings[0] as Record<string, unknown>).currency)
    : null;

  let photoCount = 0;
  const out: ImportedBean[] = [];

  for (const entry of beans) {
    if (typeof entry !== "object" || entry === null) continue;
    const b = entry as Record<string, unknown>;

    const name = str(b.name);
    if (!name) continue; // unnamed beans: nothing worth importing

    const infos: BeanInfo[] = Array.isArray(b.bean_information)
      ? b.bean_information.filter((i): i is BeanInfo => typeof i === "object" && i !== null)
      : [];

    const country = joinUnique(...infos.map((i) => str(i.country))) || null;
    const region = joinUnique(...infos.map((i) => str(i.region))) || null;
    const rawMix = str(b.beanMix);
    const mix =
      rawMix === "BLEND"
        ? "blend"
        : rawMix === "SINGLE_ORIGIN"
          ? "single-origin"
          : null;

    const process = joinUnique(...infos.map((i) => str(i.processing))) || null;

    const variety = joinUnique(...infos.map((i) => str(i.variety))) || null;

    const notes: string[] = [];
    const note = str(b.note);
    if (note) notes.push(note);

    // Blend composition, e.g. "60% Ethiopia, 40% Brazil".
    const blend = infos
      .map((i) => {
        const pct = num(i.percentage);
        if (!pct || pct <= 0) return null;
        const where = joinUnique(str(i.country), str(i.region));
        return where ? `${pct}% ${where}` : null;
      })
      .filter((p): p is string => p !== null);
    if (blend.length > 0) notes.push(`Blend: ${blend.join(", ")}.`);

    const roastRaw = str(b.roast);
    const roastCustom = str(b.roast_custom);
    const roastLevel =
      (roastRaw && ROAST_MAP[roastRaw]) ||
      (roastCustom ? roastCustom.toLowerCase() : null) ||
      roastRangeToLevel(num(b.roast_range));

    const cost = num(b.cost);
    const weight = num(b.weight);
    const rating = num(b.rating);
    const config = typeof b.config === "object" && b.config !== null ? (b.config as Record<string, unknown>) : null;

    photoCount += Array.isArray(b.attachments) ? b.attachments.length : 0;

    out.push({
      roaster: str(b.roaster) ?? "Unknown",
      name,
      country,
      region,
      mix,
      variety,
      process,
      roastLevel,
      roastDate: isoDate(b.roastingDate),
      purchaseDate: isoDate(b.buyDate),
      priceCents: cost !== null && cost > 0 ? Math.round(cost * 100) : null,
      weightGrams: weight !== null && weight > 0 ? weight : null,
      rating: rating !== null && rating >= 1 && rating <= 5 ? rating : null,
      notes: notes.length > 0 ? notes.join("\n") : null,
      tastingNotes: str((b.cupping as Record<string, unknown> | undefined)?.notes),
      decaffeinated: b.decaffeinated === true,
      sourceUuid: str(config?.uuid),
    });
  }

  return { beans: out, photoCount, currency };
}