"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importBackup, importBeanconqueror } from "@/app/actions";

export default function ImportForm() {
  const [state, formAction, isPending] = useActionState(importBeanconqueror, {});
  const [backupState, backupAction, backupPending] = useActionState(importBackup, {});

  return (
    <div className="import-columns">
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

      <div className="form-card">
        <h2 className="link-heading">Restore Bean Vault backup</h2>
        {backupState.message ? (
          <div className={backupState.imported !== undefined && backupState.message === "Backup restored." ? "import-ok" : "form-error"}>
            {backupState.message}
          </div>
        ) : null}

        {backupState.imported !== undefined && backupState.total !== undefined ? (
          <div className="import-result">
            <p>
              Restored <strong>{backupState.total}</strong> coffe{backupState.total === 1 ? "e" : "es"}
              ({backupState.imported} created, {backupState.total - backupState.imported} updated,
              {" "}{backupState.skipped ?? 0} skipped).
            </p>
            {backupState.photosSkipped ? (
              <p>
                {backupState.photosSkipped} photo{backupState.photosSkipped === 1 ? "" : "s"} restored
                with their coffees.
              </p>
            ) : null}
            <Link href="/" className="btn">View your coffees</Link>
          </div>
        ) : null}

        <form action={backupAction}>
          <div className="field">
            <label htmlFor="backup-file">Backup file</label>
            <span className="hint">
              Upload a <code>bean-vault-backup.json</code> from the Export menu. Coffees are
              updated or recreated by their id — importing the same backup twice leaves
              everything unchanged, and coffees not in the backup are kept.
            </span>
            <input id="backup-file" name="file" type="file" accept=".json,application/json" required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={backupPending}>
              {backupPending ? "Restoring…" : "Restore backup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}