import type { PhotoFields } from "@/lib/ai";

/** Form field ids an AI photo scan can propose a value for. */
export type PhotoScanFieldKey =
  | "roaster"
  | "name"
  | "country"
  | "region"
  | "variety"
  | "producer"
  | "elevation"
  | "process"
  | "roastLevel"
  | "mix"
  | "decaffeinated"
  | "tastingNotes"
  | "notes";

export type PhotoScanRow = { key: PhotoScanFieldKey; value: string | boolean };

/** Only the fields the scan actually found something for — nothing to review otherwise. */
export function scanRowsFrom(fields: PhotoFields): PhotoScanRow[] {
  const rows: PhotoScanRow[] = [];
  if (fields.roaster) rows.push({ key: "roaster", value: fields.roaster });
  if (fields.name) rows.push({ key: "name", value: fields.name });
  if (fields.country) rows.push({ key: "country", value: fields.country });
  if (fields.region) rows.push({ key: "region", value: fields.region });
  if (fields.variety) rows.push({ key: "variety", value: fields.variety });
  if (fields.producer) rows.push({ key: "producer", value: fields.producer });
  if (fields.elevation) rows.push({ key: "elevation", value: fields.elevation });
  if (fields.process) rows.push({ key: "process", value: fields.process });
  if (fields.roastLevel) rows.push({ key: "roastLevel", value: fields.roastLevel });
  if (fields.mix) rows.push({ key: "mix", value: fields.mix });
  if (fields.decaffeinated) rows.push({ key: "decaffeinated", value: true });
  if (fields.tastingNotes) rows.push({ key: "tastingNotes", value: fields.tastingNotes });
  if (fields.description) rows.push({ key: "notes", value: fields.description });
  return rows;
}

/**
 * Write a scanned value straight into the matching form input by id — the
 * coffee form (src/components/coffee-form.tsx) is a plain uncontrolled HTML
 * form, so this is the same thing a person typing into it would produce;
 * nothing is saved until the form itself is submitted.
 */
export function applyScanRow(row: PhotoScanRow) {
  const el = document.getElementById(row.key);
  if (!el) return;
  if (row.key === "decaffeinated" && el instanceof HTMLInputElement) {
    el.checked = Boolean(row.value);
    return;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    el.value = String(row.value);
  }
}
