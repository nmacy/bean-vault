"use client";

import { useActionState } from "react";
import { updateCoffeeFromLink, type LinkUpdateState } from "@/app/actions";

export default function UpdateFromLink({ id }: { id: number }) {
  const [state, formAction, isPending] = useActionState<LinkUpdateState, FormData>(updateCoffeeFromLink, {});

  return (
    <div className="update-link">
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
        <span className="update-link-label">Update from product link</span>
        <div className="link-lookup" style={{ marginBottom: 0 }}>
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