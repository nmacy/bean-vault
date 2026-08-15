"use client";

import { useActionState, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import type { Coffee } from "@/db/schema";
import type { FormState } from "@/app/actions";

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
};

export default function CoffeeForm({ action, coffee, submitLabel }: Props) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState(coffee?.photoFile ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const priceValue = coffee?.priceCents != null ? (coffee.priceCents / 100).toFixed(2) : "";
  const photoHref = currentPhoto ? `/api/photos/${currentPhoto}` : null;

  return (
    <div className="form-card">
      {state.message ? <div className="form-error">{state.message}</div> : null}
      <form action={formAction}>
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
                } else {
                  setPreview(null);
                }
              }}
            />
          </div>
          {preview ? (
            <div className="field wide">
              <span className="hint">New photo:</span>
              <img className="photo-preview" src={preview} alt="New photo preview" style={{ maxHeight: 260 }} />
            </div>
          ) : photoHref ? (
            <div className="field wide">
              <span className="hint">Current photo:</span>
              <div className="current-photo">
                <img src={photoHref} alt="Current photo" />
                <label className="check-line">
                  <input type="checkbox" name="removePhoto" value="on" checked={false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCurrentPhoto(null);
                        setPreview(null);
                        if (fileRef.current) fileRef.current.value = "";
                      } else {
                        setCurrentPhoto(coffee?.photoFile ?? null);
                      }
                    }}
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
    </div>
  );
}