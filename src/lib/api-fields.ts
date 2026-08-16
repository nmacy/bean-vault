/**
 * JSON-body → coffee-fields mapping for the HTTP API. Mirrors the form
 * validation: strict numbers (no commas/units), date formats, length caps.
 * `origin` is derived by the route from country/region + existing values.
 */

import { LIMITS } from "@/lib/validation";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ELEVATION_RE = /^[\d,.\s-–—]+$/;
const ROAST_LEVELS = ["light", "medium-light", "medium", "medium-dark", "dark"];

export function joinOrigin(country: string | null, region: string | null): string | null {
  return [country, region].filter((v): v is string => v !== null && v.length > 0).join(", ") || null;
}

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export type FieldValues = Partial<{
  roaster: string;
  name: string;
  country: string | null;
  region: string | null;
  mix: string | null;
  variety: string | null;
  producer: string | null;
  elevation: string | null;
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
  origin: string | null; // derived server-side by the route
}>;

export type MapResult = { values: FieldValues; errors: string[] };

export function mapCoffeeFields(
  body: Record<string, unknown>,
  opts: { partial: boolean },
): MapResult {
  const values: FieldValues = {};
  const errors: string[] = [];
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);

  const str = (k: string, max: number): string | null | undefined => {
    if (!has(k)) return undefined;
    const v = body[k];
    if (v === null) return null;
    if (typeof v !== "string") {
      errors.push(`${k} must be a string.`);
      return null;
    }
    const t = v.trim();
    if (!t) return null;
    return t.length > max ? t.slice(0, max) : t;
  };
  const date = (k: string): string | null | undefined => {
    const v = str(k, 10);
    if (v === undefined || v === null) return v;
    if (!DATE_RE.test(v)) {
      errors.push(`${k} must be YYYY-MM-DD.`);
      return null;
    }
    return v;
  };
  const intOrNull = (e: unknown): number | null | "invalid" => {
    if (e === null || e === "") return null;
    if (typeof e !== "number" || !Number.isInteger(e)) return "invalid";
    return e;
  };

  const roaster = str("roaster", LIMITS.roaster);
  const name = str("name", LIMITS.name);
  if (roaster !== undefined) {
    if (!roaster) errors.push(opts.partial ? "roaster cannot be empty." : "roaster is required.");
    else values.roaster = roaster;
  } else if (!opts.partial) {
    errors.push("roaster is required.");
  }
  if (name !== undefined) {
    if (!name) errors.push(opts.partial ? "name cannot be empty." : "name is required.");
    else values.name = name;
  } else if (!opts.partial) {
    errors.push("name is required.");
  }

  const maybe = <T>(raw: string | null | undefined, fn: (v: string) => T | "invalid", label: string): T | null | undefined => {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    const r = fn(raw);
    if (r === "invalid") {
      errors.push(`${label} is invalid.`);
      return null;
    }
    return r;
  };

  const country = maybe(str("country", LIMITS.origin), (v) => v, "country");
  const region = maybe(str("region", LIMITS.region), (v) => v, "region");
  const variety = maybe(str("variety", LIMITS.variety), (v) => v, "variety");
  const producer = maybe(str("producer", LIMITS.producer), (v) => v, "producer");
  const process = maybe(str("process", LIMITS.process), (v) => v, "process");
  const notes = maybe(str("notes", LIMITS.notes), (v) => v, "notes");
  const tastingNotes = maybe(str("tastingNotes", LIMITS.tastingNotes), (v) => v, "tastingNotes");
  const elevation = maybe(str("elevation", LIMITS.elevation), (v) => (ELEVATION_RE.test(v) ? v : "invalid"), "elevation");
  const roastLevelRaw = str("roastLevel", 20);
  const roastLevel = maybe(roastLevelRaw, (v) => (ROAST_LEVELS.includes(v) ? v : "invalid"), "roastLevel");
  const mixRaw = str("mix", 32);
  const mix = maybe(mixRaw, (v) => (v === "single-origin" || v === "blend" ? v : "invalid"), "mix");
  const roastDate = date("roastDate");
  const purchaseDate = date("purchaseDate");

  if (country !== undefined) values.country = country;
  if (region !== undefined) values.region = region;
  if (variety !== undefined) values.variety = variety;
  if (producer !== undefined) values.producer = producer;
  if (process !== undefined) values.process = process;
  if (notes !== undefined) values.notes = notes;
  if (tastingNotes !== undefined) values.tastingNotes = tastingNotes;
  if (elevation !== undefined) values.elevation = elevation;
  if (roastLevel !== undefined) values.roastLevel = roastLevel;
  if (mix !== undefined) values.mix = mix;
  if (roastDate !== undefined) values.roastDate = roastDate;
  if (purchaseDate !== undefined) values.purchaseDate = purchaseDate;

  if (has("priceCents")) {
    const p = intOrNull(body.priceCents);
    if (p === "invalid") errors.push("priceCents must be an integer number of cents (no commas).");
    else if (p !== null && (p < 0 || p > 100_000_000)) errors.push("priceCents is out of range.");
    else values.priceCents = p;
  }
  if (has("weightGrams")) {
    const w = intOrNull(body.weightGrams);
    if (w === "invalid") errors.push("weightGrams must be an integer.");
    else if (w !== null && (w < 1 || w > 1_000_000)) errors.push("weightGrams is out of range.");
    else values.weightGrams = w;
  }
  if (has("rating")) {
    const r = intOrNull(body.rating);
    if (r === "invalid") errors.push("rating must be an integer.");
    else if (r !== null && (r < 1 || r > 5)) errors.push("rating must be 1-5.");
    else values.rating = r;
  }
  if (has("decaffeinated")) {
    if (typeof body.decaffeinated === "boolean") values.decaffeinated = body.decaffeinated;
    else errors.push("decaffeinated must be a boolean.");
  }

  return { values, errors };
}