"use client";

import { useActionState, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import type { Coffee } from "@/db/schema";
import { scanCoffeePhoto, type FormState, type PhotoScanResult } from "@/app/actions";
import PhotoScanModal from "@/components/photo-scan-modal";
import { applyScanRow, scanRowsFrom, type PhotoScanFieldKey } from "@/lib/photo-scan-fields";

const ROAST_LEVELS = ["light", "medium-light", "medium", "medium-dark", "dark"];
const PROCESS_SUGGESTIONS = ["washed", "natural", "honey", "anaerobic", "carbonic maceration"];

/** Block any key that is not a digit (or a single decimal point for price). */
function numericKeydown(allowDot: boolean) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return;
    if (allowDot && e.key === ".") return;
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  };
}

/** Block pastes containing anything but digits/one dot. */
function numericPaste(e: ClipboardEvent<HTMLInputElement>, allowDot: boolean) {
  const text = e.clipboardData.getData("text");
  if ((allowDot ? /[^0-9.]/.test(text) || (text.match(/\./g)?.length ?? 0) > 1 : /[^0-9]/.test(text))) {
    e.preventDefault();
  }
}

/** Elevation: digits, commas, dots and range dashes only. */
function elevationKeyguard(e: KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return;
  if (!/^[0-9.,\-\s]$/.test(e.key)) e.preventDefault();
}

function elevationPaste(e: ClipboardEvent<HTMLInputElement>) {
  if (/[^0-9.,\-\s]/.test(e.clipboardData.getData("text"))) e.preventDefault();
}

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  coffee?: Coffee;
  submitLabel: string;
  /** Photo scanning only shows up once an OpenRouter key is configured (Settings). */
  hasAiKey?: boolean;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(blob);
  });
}

export default function CoffeeForm({ action, coffee, submitLabel, hasAiKey = false }: Props) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState(coffee?.photoFile ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<Extract<PhotoScanResult, { ok: true }> | null>(null);
  const [scanSelected, setScanSelected] = useState<Partial<Record<PhotoScanFieldKey, boolean>>>({});

  const priceValue = coffee?.priceCents != null ? (coffee.priceCents / 100).toFixed(2) : "";
  const photoHref = currentPhoto ? `/api/photos/${currentPhoto}` : null;

  async function runScan(dataUrl: string) {
    setScanBusy(true);
    setScanError(null);
    const res = await scanCoffeePhoto(dataUrl);
    setScanBusy(false);
    if (!res.ok) {
      setScanError(res.message);
      return;
    }
    setScanResult(res);
    const rows = scanRowsFrom(res.fields);
    setScanSelected(Object.fromEntries(rows.map((r) => [r.key, true])));
  }

  async function scanCurrentPhoto() {
    const file = fileRef.current?.files?.[0];
    if (file) {
      void runScan(await blobToDataUrl(file));
    } else if (photoHref) {
      const res = await fetch(photoHref);
      void runScan(await blobToDataUrl(await res.blob()));
    }
  }

  function toggleScanField(key: PhotoScanFieldKey) {
    setScanSelected((s) => ({ ...s, [key]: !s[key] }));
  }

  function applyScan() {
    if (!scanResult) return;
    for (const row of scanRowsFrom(scanResult.fields)) {
      if (scanSelected[row.key]) applyScanRow(row);
    }
    setScanResult(null);
  }

  return (
    <div className="form-card">
      {state.message ? <div className="form-error">{state.message}</div> : null}
      <form action={formAction}>
        {removePhoto ? <input type="hidden" name="removePhoto" value="on" /> : null}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="roaster">Roaster *</label>
            <input id="roaster" name="roaster" required defaultValue={coffee?.roaster ?? ""} placeholder="e.g. Onyx Coffee Lab" maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="name">Coffee name *</label>
            <input id="name" name="name" required defaultValue={coffee?.name ?? ""} placeholder="e.g. Southern Weather" maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="country">Country</label>
            <input id="country" name="country" defaultValue={coffee?.country ?? ""} placeholder="e.g. Colombia" />
          </div>
          <div className="field">
            <label htmlFor="region">Region</label>
            <input id="region" name="region" defaultValue={coffee?.region ?? ""} placeholder="e.g. Santa Monica" maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="mix">Type</label>
            <select id="mix" name="mix" defaultValue={coffee?.mix ?? ""}>
              <option value="">—</option>
              <option value="single-origin">Single origin</option>
              <option value="blend">Blend</option>
            </select>
          </div>
<div className="field">
              <label htmlFor="variety">Variety</label>
              <input id="variety" name="variety" defaultValue={coffee?.variety ?? ""} placeholder="e.g. Gesha, Bourbon" maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="producer">Producer</label>
              <input id="producer" name="producer" defaultValue={coffee?.producer ?? ""} placeholder="Farm or grower" maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="elevation">Elevation</label>
              <input id="elevation" name="elevation" defaultValue={coffee?.elevation ?? ""} placeholder="e.g. 1,900–2,100 (masl)" maxLength={40} onKeyDown={elevationKeyguard} onPaste={elevationPaste} />
            </div>
          <div className="field">
            <label htmlFor="process">Process</label>
            <input id="process" name="process" list="process-list" defaultValue={coffee?.process ?? ""} placeholder="e.g. washed" maxLength={80} />
            <datalist id="process-list">
              {PROCESS_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="decaffeinated">Decaffeinated</label>
            <label className="check-line">
              <input id="decaffeinated" name="decaffeinated" type="checkbox" value="on" defaultChecked={coffee?.decaffeinated ?? false} />
              This is a decaf roast
            </label>
          </div>
          <div className="field">
            <label htmlFor="roastLevel">Roast level</label>
            <select id="roastLevel" name="roastLevel" defaultValue={coffee?.roastLevel ?? ""}>
              <option value="">—</option>
              {ROAST_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="roastDate">Roast date</label>
            <input id="roastDate" name="roastDate" type="date" defaultValue={coffee?.roastDate ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="purchaseDate">Purchase date</label>
            <input id="purchaseDate" name="purchaseDate" type="date" defaultValue={coffee?.purchaseDate ?? ""} />
          </div>
          {coffee ? (
            <>
              <div className="field">
                <label htmlFor="openedAt">Opened date</label>
                <input id="openedAt" name="openedAt" type="date" defaultValue={coffee.openedAt ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="frozenAt">Frozen date</label>
                <input id="frozenAt" name="frozenAt" type="date" defaultValue={coffee.frozenAt ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="unfrozenAt">Unfrozen date</label>
                <input id="unfrozenAt" name="unfrozenAt" type="date" defaultValue={coffee.unfrozenAt ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="emptiedAt">Emptied date</label>
                <input id="emptiedAt" name="emptiedAt" type="date" defaultValue={coffee.emptiedAt ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="frozenDays">Frozen days <span className="hint">(total)</span></label>
                <input id="frozenDays" name="frozenDays" type="number" min="0" inputMode="numeric" defaultValue={coffee.frozenDays ?? 0} />
              </div>
            </>
          ) : null}
          <div className="field">
            <label htmlFor="price">Price <span className="hint">(USD)</span></label>
            <input id="price" name="price" type="text" inputMode="decimal" defaultValue={priceValue} placeholder="18.00" maxLength={10} onKeyDown={numericKeydown(true)} onPaste={(e) => numericPaste(e, true)} />
          </div>
          <div className="field">
            <label htmlFor="weight">Weight <span className="hint">(g)</span></label>
            <input id="weight" name="weight" type="text" inputMode="numeric" defaultValue={coffee?.weightGrams ?? ""} placeholder="250" maxLength={7} onKeyDown={numericKeydown(false)} onPaste={(e) => numericPaste(e, false)} />
          </div>
          <div className="field">
            <label htmlFor="rating">Rating</label>
            <select id="rating" name="rating" defaultValue={coffee?.rating ?? ""}>
              <option value="">No rating</option>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>{"★".repeat(r)}{"☆".repeat(5 - r)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="photo">Snapshot <span className="hint">(JPG, PNG, WebP, AVIF, GIF; max 10 MB)</span></label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              ref={fileRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPreview(URL.createObjectURL(file));
                  setCurrentPhoto(null);
                  setRemovePhoto(false);
                  if (hasAiKey) void blobToDataUrl(file).then(runScan);
                } else {
                  setPreview(null);
                }
              }}
            />
          </div>
          {hasAiKey && (preview || photoHref) ? (
            <div className="field wide">
              <button
                type="button"
                className="btn btn-small btn-secondary"
                onClick={() => void scanCurrentPhoto()}
                disabled={scanBusy}
              >
                <span className="ai-badge" style={{ marginRight: 6 }}>AI</span>
                {scanBusy ? "Scanning photo…" : "Scan photo for details"}
              </button>
              {scanError ? <div className="form-error" style={{ marginTop: 8 }}>{scanError}</div> : null}
            </div>
          ) : null}
          {preview ? (
            <div className="field wide">
              <span className="hint">New photo:</span>
              <img className="photo-preview" src={preview} alt="New photo preview" style={{ maxHeight: 260 }} />
            </div>
          ) : photoHref ? (
            <div className="field wide">
              <span className="hint">Current photo:</span>
              <div className="current-photo">
                {removePhoto ? (
                  <span className="current-photo-removed">Photo will be removed.</span>
                ) : (
                  <img src={photoHref} alt="Current photo" />
                )}
                <label className="check-line">
                  <input
                    type="checkbox"
                    name="removePhoto"
                    value="on"
                    checked={removePhoto}
                    onChange={(e) => setRemovePhoto(e.target.checked)}
                  />
                  Remove photo
                </label>
              </div>
            </div>
          ) : null}
          <div className="field wide">
            <label htmlFor="tastingNotes">Tasting notes</label>
            <textarea id="tastingNotes" name="tastingNotes" defaultValue={coffee?.tastingNotes ?? ""} placeholder="Sweet citrus, chocolate, syrupy body…" />
          </div>
          <div className="field wide">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" defaultValue={coffee?.notes ?? ""} placeholder="Brew recommendations, where you bought it…" />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn" disabled={isPending}>
            {isPending ? "Saving…" : submitLabel}
          </button>
          <Link href={coffee ? `/coffees/${coffee.id}` : "/"} className="btn secondary">Cancel</Link>
        </div>
      </form>
      {scanResult ? (
        <PhotoScanModal
          rows={scanRowsFrom(scanResult.fields)}
          productUrl={scanResult.productUrl}
          selected={scanSelected}
          onToggle={toggleScanField}
          onApply={applyScan}
          onClose={() => setScanResult(null)}
        />
      ) : null}
    </div>
  );
}