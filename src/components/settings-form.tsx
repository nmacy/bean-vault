"use client";

import { useActionState } from "react";
import { saveApiKey } from "@/app/actions";

export default function SettingsForm({
  configured,
  source,
}: {
  configured: boolean;
  source: "app" | "environment" | null;
}) {
  const [state, formAction, isPending] = useActionState(saveApiKey, {});

  return (
    <div className="form-card">
      <h2 className="link-heading">OpenRouter API key</h2>
      <p className="link-hint">
        Used only for the &quot;Ask AI to fill details&quot; option when adding coffee by store
        link. The key is stored in this app&apos;s local settings and is never sent to the
        browser or included in exports. If unset here, the <code>OPENROUTER_API_KEY</code>{" "}
        environment variable is used instead.
      </p>

      <div className="field">
        <label>Status</label>
        <div className="settings-status">
          {configured ? (
            source === "app"
              ? "A key is saved in this app."
              : "No saved key — using the OPENROUTER_API_KEY environment variable."
          ) : (
            "No key configured anywhere."
          )}
        </div>
      </div>

      {state.message ? (
        <div className="form-error" style={{ marginTop: 12 }}>{state.message}</div>
      ) : null}

      <form action={formAction} style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="openrouterApiKey">API key</label>
          <input
            id="openrouterApiKey"
            name="openrouterApiKey"
            type="password"
            autoComplete="new-password"
            placeholder={configured ? "Leave blank to keep the current key" : "sk-or-…"}
          />
        </div>
        <div className="form-actions" style={{ marginTop: 14 }}>
          <button type="submit" className="btn" disabled={isPending}>
            {isPending ? "Saving…" : "Save key"}
          </button>
          {configured && source === "app" ? (
            <button type="submit" name="remove" value="on" className="btn danger" disabled={isPending}>
              Remove
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}