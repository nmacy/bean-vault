"use client";

import { useEffect } from "react";
import { cap } from "@/lib/cap";
import type { PhotoScanFieldKey, PhotoScanRow } from "@/lib/photo-scan-fields";

const LABELS: Record<PhotoScanFieldKey, string> = {
  roaster: "Roaster",
  name: "Name",
  country: "Country",
  region: "Region",
  variety: "Variety",
  producer: "Producer",
  elevation: "Elevation",
  process: "Process",
  roastLevel: "Roast level",
  mix: "Type",
  decaffeinated: "Decaffeinated",
  tastingNotes: "Tasting notes",
  notes: "Notes",
};

function displayValue(row: PhotoScanRow): string {
  if (row.key === "decaffeinated") return "Yes";
  if (row.key === "mix") return row.value === "blend" ? "Blend" : "Single origin";
  if (row.key === "roastLevel") return cap(String(row.value));
  return String(row.value);
}

export default function PhotoScanModal({
  rows,
  productUrl,
  selected,
  onToggle,
  onApply,
  onClose,
}: {
  rows: PhotoScanRow[];
  productUrl: string | null;
  selected: Partial<Record<PhotoScanFieldKey, boolean>>;
  onToggle: (key: PhotoScanFieldKey) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedCount = rows.filter((r) => selected[r.key]).length;

  return (
    <div className="drill-overlay" onClick={onClose}>
      <div className="drill-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="AI photo scan results">
        <div className="drill-head">
          <div>
            <h3 className="drill-title">AI scan results</h3>
            <p className="drill-sub">
              {rows.length === 0
                ? "Nothing readable was found."
                : `${rows.length} field${rows.length === 1 ? "" : "s"} found — pick which to fill in.`}
            </p>
          </div>
          <button type="button" className="btn btn-small btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {productUrl ? (
          <p className="scan-source">
            Matched a product page:{" "}
            <a href={productUrl} target="_blank" rel="noreferrer">{productUrl}</a>
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className="scan-list">
            {rows.map((row) => (
              <label key={row.key} className="scan-row">
                <input
                  type="checkbox"
                  checked={selected[row.key] ?? false}
                  onChange={() => onToggle(row.key)}
                />
                <span className="scan-row-label">{LABELS[row.key]}</span>
                <span className="scan-row-value">{displayValue(row)}</span>
              </label>
            ))}
          </div>
        ) : null}

        <div className="drill-head scan-actions">
          <span className="link-hint" style={{ margin: 0 }}>
            This overwrites the current value for anything checked.
          </span>
          <div className="form-actions" style={{ margin: 0 }}>
            <button type="button" className="btn btn-small" onClick={onApply} disabled={selectedCount === 0}>
              Apply {selectedCount > 0 ? `${selectedCount} selected` : ""}
            </button>
            <button type="button" className="btn btn-small btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
