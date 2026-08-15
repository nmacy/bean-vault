"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importBeanconqueror } from "@/app/actions";

export default function ImportForm() {
  const [state, formAction, isPending] = useActionState(importBeanconqueror, {});

  return (
    <div className="form-card">
      {state.message ? (
        <div className={state.imported !== undefined && state.message === "Import finished." ? "import-ok" : "form-error"}>
          {state.message}
        </div>
      ) : null}

      {state.imported !== undefined && state.total !== undefined ? (
        <div className="import-result">
          <p>
            Imported <strong>{state.imported}</strong> of {state.total} beans
            ({state.total - state.imported} already in the tracker, skipped).
          </p>
          {state.photosSkipped ? (
            <p>
              {state.photosSkipped} photo{state.photosSkipped === 1 ? "" : "s"} skipped
              — Beanconqueror exports reference photos by name without embedding
              them, so they cannot be recovered.
            </p>
          ) : null}
          <Link href="/" className="btn">View your coffees</Link>
        </div>
      ) : null}

      <form action={formAction}>
        <div className="field">
          <label htmlFor="import-file">Beanconqueror export</label>
          <span className="hint">
            In Beanconqueror: Settings → Data &amp; Storage → Export to JSON, then upload that
            file here (max 50 MB). Each bean imports once; importing the same file again
            skips what already exists.
          </span>
          <input id="import-file" name="file" type="file" accept=".json,application/json" required />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn" disabled={isPending}>
            {isPending ? "Importing…" : "Import beans"}
          </button>
          <Link href="/" className="btn secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}