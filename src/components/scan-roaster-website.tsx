"use client";

import { useActionState } from "react";
import { scanRoasterWebsite, type RoasterLinkUpdateState } from "@/app/actions";

export default function ScanRoasterWebsite({ id, website }: { id: number; website: string | null }) {
  const [state, formAction, isPending] = useActionState<RoasterLinkUpdateState, FormData>(scanRoasterWebsite, {});

  if (!website) return null;

  return (
    <div className="form-card link-card">
      <h2 className="link-heading">Scan website with AI</h2>
      <p className="link-hint">
        Re-reads <strong>{website}</strong> and merges in AI-extracted details.
        Only fields the page provides are filled in — nothing else changes.
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
        <button type="submit" className="btn" disabled={isPending}>
          {isPending ? "Scanning…" : "Scan with AI"}
        </button>
      </form>
    </div>
  );
}
