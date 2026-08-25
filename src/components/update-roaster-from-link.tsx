"use client";

import { useActionState } from "react";
import { updateRoasterFromLink, type RoasterLinkUpdateState } from "@/app/actions";

export default function UpdateRoasterFromLink({ id }: { id: number }) {
  const [state, formAction, isPending] = useActionState<RoasterLinkUpdateState, FormData>(updateRoasterFromLink, {});

  return (
    <div className="form-card link-card">
      <h2 className="link-heading">Update from a link</h2>
      <p className="link-hint">
        Paste the roaster&apos;s homepage or about page and merge in AI-extracted
        details. Only fields the page provides are filled in — nothing else changes.
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
            placeholder="https://…"
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
