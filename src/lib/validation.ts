const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRICE_RE = /^\d+(\.\d+)?$/;
const ELEVATION_RE = /^[\d,.\s-–—]+$/;

/** Field length caps shared with the forms' maxLength attributes. */
export const LIMITS = {
  roaster: 120,
  name: 120,
  origin: 80,
  region: 80,
  variety: 120,
  producer: 120,
  elevation: 40,
  process: 80,
  notes: 4000,
  tastingNotes: 4000,
};

/** Trimmed string (capped at LIMITS[name]), or null when empty. */
export function text(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const cap = (LIMITS as Record<string, number>)[name];
  return cap && trimmed.length > cap ? trimmed.slice(0, cap) : trimmed;
}

/** Required non-empty string, else null. */
export function requiredText(form: FormData, name: string): string | null {
  return text(form, name);
}

/** Accepts YYYY-MM-DD, else null. */
export function dateField(form: FormData, name: string): string | null {
  const value = text(form, name);
  return value !== null && DATE_RE.test(value) ? value : null;
}

/** Integer within [min, max]; null when empty, invalid or non-numeric. */
export function intField(form: FormData, name: string, min: number, max: number): number | null {
  const value = text(form, name);
  if (value === null) return null;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

/** Decimal dollars ("12.50") to cents; null when empty or invalid (no commas/units). */
export function dollarsToCents(form: FormData, name: string): number | null {
  const value = text(form, name);
  if (value === null) return null;
  if (!PRICE_RE.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Elevation: plain masl numbers only (digits, commas, ranges). */
export function elevationField(form: FormData, name: string): string | null {
  const value = text(form, name);
  if (value === null) return null;
  return ELEVATION_RE.test(value) ? value : null;
}

/** A photo file input value, or null when absent/empty. */
export function photoFile(form: FormData): File | null {
  const file = form.get("photo");
  return file instanceof File && file.size > 0 ? file : null;
}