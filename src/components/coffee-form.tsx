"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import type { Coffee } from "@/db/schema";
import type { FormState } from "@/app/actions";

const ROAST_LEVELS = ["light", "medium-light", "medium", "medium-dark", "dark"];
const PROCESS_SUGGESTIONS = ["washed", "natural", "honey", "anaerobic", "carbonic maceration", "decaffeinated"];

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
            <input id="roaster" name="roaster" required defaultValue={coffee?.roaster ?? ""} placeholder="e.g. Onyx Coffee Lab" />
          </div>
          <div className="field">
            <label htmlFor="name">Coffee name *</label>
            <input id="name" name="name" required defaultValue={coffee?.name ?? ""} placeholder="e.g. Southern Weather" />
          </div>
          <div className="field">
            <label htmlFor="origin">Origin</label>
            <input id="origin" name="origin" defaultValue={coffee?.origin ?? ""} placeholder="Country or region" />
          </div>
          <div className="field">
            <label htmlFor="variety">Variety</label>
            <input id="variety" name="variety" defaultValue={coffee?.variety ?? ""} placeholder="e.g. Gesha, Bourbon" />
          </div>
          <div className="field">
            <label htmlFor="process">Process</label>
            <input id="process" name="process" list="process-list" defaultValue={coffee?.process ?? ""} placeholder="e.g. washed" />
            <datalist id="process-list">
              {PROCESS_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
            </datalist>
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
            <input id="price" name="price" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={priceValue} placeholder="18.00" />
          </div>
          <div className="field">
            <label htmlFor="weight">Weight <span className="hint">(g)</span></label>
            <input id="weight" name="weight" type="number" inputMode="numeric" step="1" min="1" defaultValue={coffee?.weightGrams ?? ""} placeholder="250" />
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
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" defaultValue={coffee?.notes ?? ""} placeholder="Tasting notes, brew recommendations, where you bought it…" />
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