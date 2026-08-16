"use client";

import { useActionState, useState } from "react";
import { generateApiKey, revokeApiKey } from "@/app/actions";

export default function ApiKeysForm({
  keys,
}: {
  keys: { id: string; name: string; createdAt: string }[];
}) {
  const [genState, genAction, genPending] = useActionState(generateApiKey, {});
  const [revState, revAction, revPending] = useActionState(revokeApiKey, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="form-card">
      <h2 className="link-heading">API access</h2>
      <p className="link-hint">
        Keys allow scripts and other apps to read and write your coffees via
        <code> /api/v1/coffees</code> (Authorization: Bearer). Secrets are shown once and
        stored only as hashes.
      </p>

      {genState.key ? (
        <div className="import-ok">
          {genState.message}
          <div className="api-key-secret">
            <code>{genState.key}</code>
            <button
              type="button"
              className="btn btn-small btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(genState.key ?? "").catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : genState.message ? (
        <div className={genState.ok ? "import-ok" : "form-error"}>{genState.message}</div>
      ) : null}

      <form action={genAction} style={{ marginTop: 12 }}>
        <div className="link-lookup" style={{ marginBottom: 0 }}>
          <input
            className="filter-search link-url"
            name="name"
            placeholder="Name (e.g. home-assistant)"
            maxLength={80}
            required
          />
          <button type="submit" className="btn" disabled={genPending}>
            {genPending ? "Generating…" : "Generate key"}
          </button>
        </div>
      </form>

      {keys.length > 0 ? (
        <div className="api-keys-list">
          <div className="api-keys-title">Active keys</div>
          {keys.map((k) => (
            <div key={k.id} className="api-key-row">
              <span className="api-key-name">{k.name}</span>
              <span className="api-key-meta">{new Date(k.createdAt).toLocaleDateString()}</span>
              <form
                action={revAction}
                onSubmit={() => {
                  if (!confirm(`Revoke "${k.name}"?`)) return false;
                }}
              >
                <input type="hidden" name="id" value={k.id} />
                <button type="submit" className="btn btn-small danger" disabled={revPending}>
                  Revoke
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      {revState.message ? (
        <div className={revState.ok ? "import-ok" : "form-error"} style={{ marginTop: 12 }}>{revState.message}</div>
      ) : null}
    </div>
  );
}