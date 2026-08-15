const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Trimmed string, or null when empty. */
export function text(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

/** Integer within [min, max], or null when empty/invalid. */
export function intField(form: FormData, name: string, min: number, max: number): number | null {
  const value = text(form, name);
  if (value === null) return null;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

/** Decimal dollars ("12.50") to cents, rounded; null when empty/invalid. */
export function dollarsToCents(form: FormData, name: string): number | null {
  const value = text(form, name);
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** A photo file input value, or null when absent/empty. */
export function photoFile(form: FormData): File | null {
  const file = form.get("photo");
  return file instanceof File && file.size > 0 ? file : null;
}