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

function sanitizePrice(v: string): string {
  let out = "";
  let dot = false;
  for (const ch of v) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && !dot) { out += ch; dot = true; }
  }
  return out.slice(0, 10);
}

function sanitizeWeight(v: string): string {
  return v.replace(/\D/g, "").slice(0, 7);
}

function sanitizeElevation(v: string): string {
  return v.replace(/[^0-9.,\-\s]/g, "").slice(0, 40);
}

export default function LinkImportForm() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Extract<LinkLookupResult, { ok: true }>["product"] | null>(null);
  const [aiOnly, setAiOnly] = useState(false);
  const [variantIndex, setVariantIndex] = useState(0);
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState<{ label: string }[] | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [state, formAction, isPending] = useActionState(createCoffeeFromLink, {});

  // AI-filled, editable fields
  const [roaster, setRoaster] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [variety, setVariety] = useState("");
  const [producer, setProducer] = useState("");
  const [elevation, setElevation] = useState("");
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
    setAiFilled(null);
    setAiOnly(false);
    setAiUsed(false);
    const res = await lookupProductLink(trimmed);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setProduct(res.product);
    setRoaster(res.product.roaster);
    setAiOnly(res.aiOnly === true);
    const first = res.product.variants[0];
    setVariantIndex(0);
    setPrice(first?.priceCents != null ? (first.priceCents / 100).toFixed(2) : "");
    setWeight(first?.weightGrams != null ? String(first.weightGrams) : "");
    // Auto-fill: if a key is configured, run the AI right away.
    await applyAiFill();
  }

  function chooseVariant(i: number) {
    setVariantIndex(i);
    const v = product?.variants[i];
    if (v) {
      setPrice(v.priceCents != null ? (v.priceCents / 100).toFixed(2) : "");
      setWeight(v.weightGrams != null ? String(v.weightGrams) : "");
    }
  }

  async function applyAiFill() {
    if (!url.trim()) return;
    setAiBusy(true);
    setAiNote(null);
    setAiFilled(null);
    const res = await aiEnrichProduct(url.trim());
    setAiBusy(false);
    if (!res.ok) {
      setAiFilled([]);
      setAiUsed(false);
      setAiNote(res.message);
      return;
    }
    const f = res.fields;
    setCountry(f.country ?? "");
    setRegion(f.region ?? "");
    setVariety(f.variety ?? "");
    setProducer(f.producer ?? "");
    setElevation(f.elevation ?? "");
    setProcess(f.process ?? "");
    setRoastLevel(f.roastLevel ?? "");
    setMix(f.mix ?? "");
    setDecaf(f.decaffeinated);
    setTastingNotes(f.tastingNotes ?? "");
    if (!notes) setNotes(f.description ?? "");
    const filled: { label: string }[] = [];
    if (f.country) filled.push({ label: "Country" });
    if (f.region) filled.push({ label: "Region" });
    if (f.variety) filled.push({ label: "Variety" });
    if (f.producer) filled.push({ label: "Producer" });
    if (f.elevation) filled.push({ label: "Elevation" });
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
    setVariety("");
    setProducer("");
    setElevation("");
    setProcess("");
    setRoastLevel("");
    setMix("");
    setDecaf(false);
    setTastingNotes("");
    setAiFilled(null);
    setAiUsed(false);
    setAiNote(null);
  }

  const aiNoKey = aiNote === "OpenRouter API key is not configured.";

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

          {aiOnly ? (
            <p className="form-error" style={{ marginBottom: 14 }}>
              This store has no product feed, so the bag info comes from reading the page
              itself — check the details, and use &quot;Ask AI to fill details&quot; below for the rest.
            </p>
          ) : null}

          <div className="link-product">
            {product.imageUrl ? <img src={product.imageUrl} alt="" className="link-thumb" /> : null}
            <div>
              <div className="link-roaster">{product.roaster}</div>
              <div className="link-name">{product.name}</div>
            </div>
          </div>

          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="link-roaster">Roaster</label>
              <input id="link-roaster" name="roaster" value={roaster} onChange={(e) => setRoaster(e.target.value)} maxLength={120} />
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

          {aiUsed ? <input type="hidden" name="aiUsed" value="on" /> : null}
          {aiBusy ? (
            <div className="ai-banner">
              <span className="ai-banner-title">
                <span className="ai-badge">AI</span>
                Reading the store page and filling details…
              </span>
            </div>
          ) : aiNote ? (
            aiFilled && aiFilled.length > 0 ? (
              <div className="ai-banner">
                <span className="ai-banner-title">
                  <span className="ai-badge">AI</span>
                  AI filled {aiFilled.length} field{aiFilled.length === 1 ? "" : "s"} from the store page
                </span>
                <span className="ai-banner-body">
                  {aiNote}
                  <span className="ai-chips">
                    {aiFilled.map((c) => (
                      <span key={c.label} className="ai-chip">{c.label}</span>
                    ))}
                  </span>
                </span>
                <div className="form-actions" style={{ margin: 0 }}>
                  <button type="button" className="btn btn-small btn-secondary" onClick={clearAi}>
                    Undo AI fill
                  </button>
                </div>
              </div>
            ) : aiNoKey ? (
              <p className="ai-note">
                No AI fill — add an OpenRouter API key in{" "}
                <Link href="/settings">Settings</Link> to auto-fill details.
              </p>
            ) : (
              <div className="form-error">
                <span className="ai-banner-body">{aiNote}</span>
                <button
                  type="button"
                  className="btn btn-small btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => void applyAiFill()}
                  disabled={aiBusy}
                >
                  Retry
                </button>
              </div>
            )
          ) : null}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="link-name">Name</label>
              <input id="link-name" name="name" defaultValue={product.name} />
            </div>
            <div className="field">
              <label htmlFor="link-price">Price <span className="hint">(USD)</span></label>
              <input id="link-price" name="price" type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(sanitizePrice(e.target.value))} placeholder="18.00" maxLength={10} />
            </div>
            <div className="field">
              <label htmlFor="link-weight">Weight <span className="hint">(g)</span></label>
              <input id="link-weight" name="weight" type="text" inputMode="numeric" value={weight} onChange={(e) => setWeight(sanitizeWeight(e.target.value))} placeholder="250" maxLength={7} />
            </div>
            <div className="field">
              <label htmlFor="link-country">Country</label>
              <input id="link-country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Colombia" maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="link-region">Region</label>
              <input id="link-region" name="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Santa Monica" maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="link-variety">Variety</label>
              <input id="link-variety" name="variety" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="e.g. Gesha" maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="link-producer">Producer</label>
              <input id="link-producer" name="producer" value={producer} onChange={(e) => setProducer(e.target.value)} placeholder="Farm or grower" maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="link-elevation">Elevation</label>
              <input id="link-elevation" name="elevation" value={elevation} onChange={(e) => setElevation(sanitizeElevation(e.target.value))} placeholder="e.g. 1,900–2,100 (masl)" maxLength={40} />
            </div>
            <div className="field">
              <label htmlFor="link-process">Process</label>
              <input id="link-process" name="process" value={process} onChange={(e) => setProcess(e.target.value)} placeholder="e.g. washed" maxLength={120} />
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
              <textarea id="link-tasting" name="tastingNotes" value={tastingNotes} onChange={(e) => setTastingNotes(e.target.value)} placeholder="Sweet citrus, chocolate, syrupy body…" maxLength={120} />
            </div>
            <div className="field wide">
              <label htmlFor="link-notes">Notes / description</label>
              <textarea id="link-notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about this bag…" maxLength={120} />
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