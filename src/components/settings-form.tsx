"use client";

import { useActionState } from "react";
import { saveAiModel, saveApiKey } from "@/app/actions";

export default function SettingsForm({
  configured,
  source,
  modelSource,
  currentModel,
  availableModels,
}: {
  configured: boolean;
  source: "app" | "environment" | null;
  modelSource: "app" | "environment" | "default";
  currentModel: string;
  availableModels: string[];
}) {
  const [state, formAction, isPending] = useActionState(saveApiKey, {});
  const [modelState, modelAction, modelPending] = useActionState(saveAiModel, {});

  return (
    <div className="form-card">
      <h2 className="link-heading">OpenRouter</h2>
      <p className="link-hint">
        Used only for the &quot;Ask AI to fill details&quot; option when adding coffee by store
        link. The key is stored in this app&apos;s local settings and is never sent to the
        browser or included in exports.
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

      <div className="settings-divider" />

      <form action={modelAction}>
        <div className="field">
          <label htmlFor="openrouterModel">Model</label>
          <input
            id="openrouterModel"
            name="openrouterModel"
            list="openrouter-model-list"
            placeholder={currentModel}
            defaultValue=""
          />
          <datalist id="openrouter-model-list">
            {availableModels.map((m) => <option key={m} value={m} />)}
          </datalist>
          <span className="hint">
            Using: <code>{currentModel}</code>
            {modelSource === "app" ? " (saved here)" : modelSource === "environment" ? " (OPENROUTER_MODEL env)" : " (default)"}
            {availableModels.length > 0
              ? ` — type to search ${availableModels.length} models`
              : " — add your API key to load the model list"}
          </span>
        </div>
        {modelState.message ? (
          <div className="form-error" style={{ marginTop: 12 }}>{modelState.message}</div>
        ) : null}
        <div className="form-actions" style={{ marginTop: 14 }}>
          <button type="submit" className="btn" disabled={modelPending}>
            {modelPending ? "Saving…" : "Save model"}
          </button>
          {modelSource === "app" ? (
            <button type="submit" name="resetModel" value="on" className="btn danger" disabled={modelPending}>
              Reset to default
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}