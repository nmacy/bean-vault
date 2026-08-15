import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { openRouterModels } from "@/lib/ai";
import SettingsForm from "@/components/settings-form";
import ImportPanel from "@/components/import-panel";
import { resolveAiKey, resolveAiModel } from "@/app/actions";

export const metadata = { title: "Settings · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const keyRow = await db.select().from(settings).where(eq(settings.key, "openrouter_api_key"));
  const value = keyRow[0]?.value ?? "";
  const aiKey = (await resolveAiKey()).trim();
  const aiSource: "app" | "environment" | null = value
    ? "app"
    : process.env.OPENROUTER_API_KEY
      ? "environment"
      : null;

  const [savedModel, storedModelRow] = await Promise.all([
    resolveAiModel(),
    db.select().from(settings).where(eq(settings.key, "openrouter_model")),
  ]);
  const modelSource: "app" | "environment" | "default" = (storedModelRow[0]?.value ?? "")
    ? "app"
    : process.env.OPENROUTER_MODEL
      ? "environment"
      : "default";
  const availableModels = aiKey
    ? await openRouterModels().catch(() => [])
    : [];

  return (
    <main className="page page-narrow">
      <Link href="/coffees" className="back-link">← Back to coffees</Link>
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <section className="form-card settings-section">
        <h2 className="link-heading">Data</h2>
        <p className="link-hint">
          Get your coffees out, or bring new ones in. Backups carry every photo;
          CSV is the plain table for spreadsheets.
        </p>

        <div className="export-options">
          <a href="/api/export/json" className="export-option">
            <span className="export-option-title">Backup</span>
            <span className="export-option-sub">Everything, photos included — restores into Bean Vault</span>
            <span className="btn">Download JSON</span>
          </a>
          <a href="/api/export" className="export-option">
            <span className="export-option-title">CSV</span>
            <span className="export-option-sub">Just the table of data, for spreadsheets</span>
            <span className="btn">Download CSV</span>
          </a>
        </div>
      </section>

      <ImportPanel />

      <SettingsForm
        configured={!!value}
        source={aiSource}
        modelSource={modelSource}
        currentModel={savedModel}
        availableModels={availableModels}
      />
    </main>
  );
}