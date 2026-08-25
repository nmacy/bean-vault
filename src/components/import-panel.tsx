"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { importBackup, importBeanVaultCsv, importBeanconqueror } from "@/app/actions";

type Mode = "backup" | "csv" | "beanconqueror";

const MODES: { key: Mode; title: string; sub: string }[] = [
  { key: "backup", title: "Bean Vault JSON", sub: "Restore the backup, photos included" },
  { key: "csv", title: "Bean Vault CSV", sub: "Import the exported table" },
  { key: "beanconqueror", title: "Beanconqueror", sub: "Your history from the app" },
];

export default function ImportPanel() {
  const [mode, setMode] = useState<Mode>("backup");
  const [state, formAction, isPending] = useActionState(importBeanconqueror, {});
  const [backupState, backupAction, backupPending] = useActionState(importBackup, {});
  const [csvState, csvAction, csvPending] = useActionState(importBeanVaultCsv, {});

  return (
    <section className="form-card">
      <h2 className="link-heading">Import</h2>
      <p className="link-hint">
        Bring coffees in from another source. Choose what you are importing.
      </p>

      <div className="import-switch" role="group" aria-label="Import format">
        {MODES.map((m) => (
          <label key={m.key} className={`import-mode${mode === m.key ? " selected" : ""}`}>
            <input
              type="radio"
              name="import-mode"
              checked={mode === m.key}
              onChange={() => setMode(m.key)}
            />
            <span className="import-mode-title">{m.title}</span>
            <span className="import-mode-sub">{m.sub}</span>
          </label>
        ))}
      </div>

      {mode === "backup" ? (
        <form action={backupAction}>
          <div className="field">
            <span className="hint">
              Upload a <code>bean-vault-backup.json</code> from the Export card above. Coffees are
              updated or recreated by their id, roaster profiles (logo included) by name —
              importing the same backup twice leaves everything unchanged, and coffees/roasters
              not in the backup are kept.
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
                  {backupState.roastersRestored ? (
                    <p>{backupState.roastersRestored} roaster{backupState.roastersRestored === 1 ? "" : "s"} restored.</p>
                  ) : null}
                  <Link href="/coffees" className="btn">Browse coffees</Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : mode === "csv" ? (
        <form action={csvAction}>
          <div className="field">
            <span className="hint">
Upload a <code>bean-vault-export.csv</code> from the Export card above. Rows with an
              id update that coffee; new or missing ids insert. A photo is attached only when
              the file it names exists in this app&apos;s uploads folder.
            </span>
            <input name="file" type="file" accept=".csv,text/csv" required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={csvPending}>
              {csvPending ? "Importing…" : "Import Bean Vault CSV"}
            </button>
          </div>

          {csvState.message ? (
            <div className={csvState.imported !== undefined && csvState.message === "CSV imported." ? "import-ok" : "form-error"}>
              {csvState.message}
              {csvState.imported !== undefined && csvState.total !== undefined ? (
                <div className="import-result">
                  <p>
                    Imported <strong>{csvState.imported}</strong> new, updated{" "}
                    <strong>{csvState.total - csvState.imported}</strong> coffees
                    ({csvState.skipped ?? 0} incomplete rows skipped).
                  </p>
                  {csvState.photosSkipped ? (
                    <p>{csvState.photosSkipped} photo{csvState.photosSkipped === 1 ? "" : "s"} referenced but not present in uploads — left without a snapshot.</p>
                  ) : null}
                  <Link href="/coffees" className="btn">Browse coffees</Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : (
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
      )}
    </section>
  );
}