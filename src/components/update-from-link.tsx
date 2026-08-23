"use client";

import { useActionState } from "react";
import { updateCoffeeFromLink, type LinkUpdateState } from "@/app/actions";

export default function UpdateFromLink({ id }: { id: number }) {
  const [state, formAction, isPending] = useActionState<LinkUpdateState, FormData>(updateCoffeeFromLink, {});

  return (
    <div className="form-card link-card">
      <h2 className="link-heading">Update from product link</h2>
      <p className="link-hint">
        Re-read the product page and merge in AI-extracted details. Only fields the
        page provides are filled in — nothing else changes.
      </p>

      {state.message ? (
        <div className={state.ok ? "import-ok" : "form-error"}>{state.message}</div>
      ) : null}
      {state.applied && state.applied.length > 0 ? (
        <div className="ai-chips" style={{ margin: "8px 0 0" }}>
          {state.applied.map((f) => (
            <span key={f} className="ai-chip">Updated: {f}</span>
          ))}
        </div>
      ) : null}
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <div className="link-lookup">
          <input
            className="filter-search link-url"
            type="url"
            name="url"
            placeholder="https://…/products/…"
            required
          />
          <button type="submit" className="btn" disabled={isPending}>
            {isPending ? "Updating…" : "Update with AI"}
          </button>
        </div>
      </form>
    </div>
  );
}