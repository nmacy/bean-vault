"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  aiEnrichProduct,
  createCoffeeFromLink,
  lookupProductLink,
  type LinkLookupResult,
} from "@/app/actions";

const ROAST_LEVELS = ["light", "medium-light", "medium", "medium-dark", "dark"];

export default function LinkImportForm() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Extract<LinkLookupResult, { ok: true }>["product"] | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState<{ label: string }[] | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [state, formAction, isPending] = useActionState(createCoffeeFromLink, {});

  // AI-filled, editable fields
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [process, setProcess] = useState("");
  const [roastLevel, setRoastLevel] = useState("");
  const [mix, setMix] = useState("");
  const [decaf, setDecaf] = useState(false);
  const [tastingNotes, setTastingNotes] = useState("");
  const [notes, setNotes] = useState("");

  async function lookUp() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a store product link first.");
      return;
    }
    setBusy(true);
    setError(null);
    setProduct(null);
    setAiNote(null);
    const res = await lookupProductLink(trimmed);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setProduct(res.product);
    const first = res.product.variants[0];
    setVariantIndex(0);
    setPrice(first?.priceCents != null ? (first.priceCents / 100).toFixed(2) : "");
    setWeight(first?.weightGrams != null ? String(first.weightGrams) : "");
  }

  function chooseVariant(i: number) {
    setVariantIndex(i);
    const v = product?.variants[i];
    if (v) {
      setPrice(v.priceCents != null ? (v.priceCents / 100).toFixed(2) : "");
      setWeight(v.weightGrams != null ? String(v.weightGrams) : "");
    }
  }

  async function askAi() {
    if (!url.trim()) return;
    setAiBusy(true);
    setAiNote(null);
    setAiFilled(null);
    const res = await aiEnrichProduct(url.trim());
    setAiBusy(false);
    if (!res.ok) {
      setAiNote(res.message);
      return;
    }
    const f = res.fields;
    setCountry(f.country ?? "");
    setRegion(f.region ?? "");
    setProcess(f.process ?? "");
    setRoastLevel(f.roastLevel ?? "");
    setMix(f.mix ?? "");
    setDecaf(f.decaffeinated);
    setTastingNotes(f.tastingNotes ?? "");
    if (!notes) setNotes(f.description ?? "");
    const filled: { label: string }[] = [];
    if (f.country) filled.push({ label: "Country" });
    if (f.region) filled.push({ label: "Region" });
    if (f.process) filled.push({ label: "Process" });
    if (f.roastLevel) filled.push({ label: "Roast" });
    if (f.mix) filled.push({ label: "Type" });
    if (f.decaffeinated) filled.push({ label: "Decaf" });
    if (f.tastingNotes) filled.push({ label: "Tasting notes" });
    if (f.description) filled.push({ label: "Description" });
    setAiFilled(filled);
    if (filled.length > 0) {
      setAiUsed(true);
      setAiNote("AI read the store page and filled the fields below — adjust anything before saving.");
    } else {
      setAiUsed(true);
      setAiNote("The AI read the store page but found no extra details to add. The name, price and photo are filled.");
    }
  }

  function clearAi() {
    setCountry("");
    setRegion("");
    setProcess("");
    setRoastLevel("");
    setMix("");
    setDecaf(false);
    setTastingNotes("");
    setAiFilled(null);
    setAiUsed(false);
    setAiNote(null);
  }

  return (
    <div className="form-card link-card">
      <h2 className="link-heading">Add from a store link</h2>
      <p className="link-hint">
        Paste the product page you are buying from (e.g. <code>happymugcoffee.com/products/…</code>).
        If the store offers bag sizes, you will be asked which one you are buying.
      </p>

      <div className="link-lookup">
        <input
          className="filter-search link-url"
          type="url"
          placeholder="https://…/products/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="button" className="btn" onClick={() => void lookUp()} disabled={busy}>
          {busy ? "Looking up…" : "Look up"}
        </button>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      {product ? (
        <form action={formAction} className="link-result">
          {state.message ? <div className="form-error">{state.message}</div> : null}
          <input type="hidden" name="url" value={url.trim()} />
          <input type="hidden" name="variantIndex" value={variantIndex} />
          <input type="hidden" name="roaster" value={product.roaster} />

          <div className="link-product">
            {product.imageUrl ? <img src={product.imageUrl} alt="" className="link-thumb" /> : null}
            <div>
              <div className="link-roaster">{product.roaster}</div>
              <div className="link-name">{product.name}</div>
            </div>
          </div>

          {product.variants.length > 1 ? (
            <div className="field wide">
              <label>Which bag are you buying?</label>
              <div className="variant-list">
                {product.variants.map((v, i) => (
                  <label
                    key={v.id}
                    className={`variant-option${i === variantIndex ? " selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="variant"
                      value={i}
                      checked={i === variantIndex}
                      onChange={() => chooseVariant(i)}
                    />
                    <span className="variant-label">{v.label}</span>
                    <span className="variant-meta">
                      {v.weightGrams != null ? `${v.weightGrams} g` : ""}
                      {v.priceCents != null ? ` · $${(v.priceCents / 100).toFixed(2)}` : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="form-actions">
            <button type="button" className="btn secondary" onClick={() => void askAi()} disabled={aiBusy}>
              {aiBusy ? "Asking AI…" : "Ask AI to fill details"}
            </button>
          </div>
          {aiUsed ? <input type="hidden" name="aiUsed" value="on" /> : null}
          {aiNote ? (
            <div className={aiFilled ? "ai-banner" : "form-error"}>
              <span className="ai-banner-title">
                <span className="ai-badge">AI</span>
                {aiFilled ? "AI extracted details from the store page" : "AI note"}
              </span>
              {aiFilled ? (
                <span className="ai-banner-body">
                  {aiNote}
                  <span className="ai-chips">
                    {aiFilled.map((c) => (
                      <span key={c.label} className="ai-chip">{c.label}</span>
                    ))}
                  </span>
                </span>
              ) : (
                <span className="ai-banner-body">{aiNote}</span>
              )}
              {aiFilled ? (
                <button type="button" className="btn btn-small btn-secondary" onClick={clearAi}>
                  Undo AI fill
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="link-name">Name</label>
              <input id="link-name" name="name" defaultValue={product.name} />
            </div>
            <div className="field">
              <label htmlFor="link-price">Price <span className="hint">(USD)</span></label>
              <input id="link-price" name="price" type="number" inputMode="decimal" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="link-weight">Weight <span className="hint">(g)</span></label>
              <input id="link-weight" name="weight" type="number" inputMode="numeric" step="1" min="1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="link-country">Country</label>
              <input id="link-country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Colombia" />
            </div>
            <div className="field">
              <label htmlFor="link-region">Region</label>
              <input id="link-region" name="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Santa Monica" />
            </div>
            <div className="field">
              <label htmlFor="link-process">Process</label>
              <input id="link-process" name="process" value={process} onChange={(e) => setProcess(e.target.value)} placeholder="e.g. washed" />
            </div>
            <div className="field">
              <label htmlFor="link-roast">Roast level</label>
              <select id="link-roast" name="roastLevel" value={roastLevel} onChange={(e) => setRoastLevel(e.target.value)}>
                <option value="">—</option>
                {ROAST_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="link-mix">Type</label>
              <select id="link-mix" name="mix" value={mix} onChange={(e) => setMix(e.target.value)}>
                <option value="">—</option>
                <option value="single-origin">Single origin</option>
                <option value="blend">Blend</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="link-decaf">Decaffeinated</label>
              <label className="check-line">
                <input id="link-decaf" name="decaffeinated" type="checkbox" value="on" checked={decaf} onChange={(e) => setDecaf(e.target.checked)} />
                This is a decaf roast
              </label>
            </div>
            <div className="field wide">
              <label htmlFor="link-tasting">Tasting notes</label>
              <textarea id="link-tasting" name="tastingNotes" value={tastingNotes} onChange={(e) => setTastingNotes(e.target.value)} placeholder="Sweet citrus, chocolate, syrupy body…" />
            </div>
            <div className="field wide">
              <label htmlFor="link-notes">Notes / description</label>
              <textarea id="link-notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about this bag…" />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn" disabled={isPending}>
              {isPending ? "Saving…" : "Save coffee"}
            </button>
            <Link href="/coffees" className="btn secondary">Cancel</Link>
          </div>
        </form>
      ) : null}
    </div>
  );
}