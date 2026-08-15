"use client";

import { useState } from "react";
import Link from "next/link";
import { createCoffeeFromLink, lookupProductLink, type FormState, type LinkLookupResult } from "@/app/actions";
import { useActionState } from "react";

export default function LinkImportForm() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Extract<LinkLookupResult, { ok: true }>["product"] | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [state, formAction, isPending] = useActionState(createCoffeeFromLink, {});

  async function lookUp() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a store product link first.");
      return;
    }
    setBusy(true);
    setError(null);
    setProduct(null);
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
            <div className="field wide">
              <label htmlFor="link-notes">Notes</label>
              <textarea id="link-notes" name="notes" placeholder="Anything worth remembering about this bag…" />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn" disabled={isPending}>
              {isPending ? "Saving…" : "Save coffee"}
            </button>
            <Link href="/" className="btn secondary">Cancel</Link>
          </div>
        </form>
      ) : null}
    </div>
  );
}