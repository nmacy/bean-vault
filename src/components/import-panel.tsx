"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { importBackup, importBeanconqueror } from "@/app/actions";

type Mode = "beanconqueror" | "backup";

export default function ImportPanel() {
  const [mode, setMode] = useState<Mode>("beanconqueror");
  const [state, formAction, isPending] = useActionState(importBeanconqueror, {});
  const [backupState, backupAction, backupPending] = useActionState(importBackup, {});

  return (
    <section className="form-card">
      <h2 className="link-heading">Import</h2>
      <p className="link-hint">
        Bring coffees in from another source. Choose what you are importing.
      </p>

      <div className="import-switch" role="group" aria-label="Import format">
        <label className={`import-mode${mode === "beanconqueror" ? " selected" : ""}`}>
          <input
            type="radio"
            name="import-mode"
            checked={mode === "beanconqueror"}
            onChange={() => setMode("beanconqueror")}
          />
          <span className="import-mode-title">Beanconqueror export</span>
          <span className="import-mode-sub">Your history from the app</span>
        </label>
        <label className={`import-mode${mode === "backup" ? " selected" : ""}`}>
          <input
            type="radio"
            name="import-mode"
            checked={mode === "backup"}
            onChange={() => setMode("backup")}
          />
          <span className="import-mode-title">Bean Vault backup</span>
          <span className="import-mode-sub">Restore the backup JSON</span>
        </label>
      </div>

      {mode === "beanconqueror" ? (
        <form action={formAction}>
          <div className="field">
            <span className="hint">
              In Beanconqueror: Settings → Data &amp; Storage → Export to JSON, then upload that
              file here (max 50 MB). Each bean imports once; a re-import skips what already exists.
            </span>
            <input name="file" type="file" accept=".json,application/json" required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={isPending}>
              {isPending ? "Importing…" : "Import from Beanconqueror"}
            </button>
          </div>

          {state.message ? (
            <div className={state.imported !== undefined && state.message === "Import finished." ? "import-ok" : "form-error"}>
              {state.message}
              {state.imported !== undefined && state.total !== undefined ? (
                <div className="import-result">
                  <p>
                    Imported <strong>{state.imported}</strong> of {state.total} beans
                    ({state.total - state.imported} already present).
                  </p>
                  {state.photosSkipped ? (
                    <p>
                      {state.photosSkipped} photo{state.photosSkipped === 1 ? "" : "s"} skipped —
                      Beanconqueror exports reference photos by name without embedding them.
                    </p>
                  ) : null}
                  <Link href="/coffees" className="btn">Browse coffees</Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : (
        <form action={backupAction}>
          <div className="field">
            <span className="hint">
              Upload a <code>bean-vault-backup.json</code> from the Export card above. Coffees are
              updated or recreated by their id — importing the same backup twice leaves everything
              unchanged, and coffees not in the backup are kept.
            </span>
            <input name="file" type="file" accept=".json,application/json" required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={backupPending}>
              {backupPending ? "Restoring…" : "Restore backup"}
            </button>
          </div>

          {backupState.message ? (
            <div className={backupState.imported !== undefined && backupState.message === "Backup restored." ? "import-ok" : "form-error"}>
              {backupState.message}
              {backupState.imported !== undefined && backupState.total !== undefined ? (
                <div className="import-result">
                  <p>
                    Restored <strong>{backupState.total}</strong> coffe{backupState.total === 1 ? "e" : "es"}
                    ({backupState.imported} created, {backupState.total - backupState.imported} updated,
                    {" "}{backupState.skipped ?? 0} skipped).
                  </p>
                  {backupState.photosSkipped ? (
                    <p>{backupState.photosSkipped} photo{backupState.photosSkipped === 1 ? "" : "s"} restored with their coffees.</p>
                  ) : null}
                  <Link href="/coffees" className="btn">Browse coffees</Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      )}
    </section>
  );
}