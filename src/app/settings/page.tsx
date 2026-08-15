import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import SettingsForm from "@/components/settings-form";
import ImportPanel from "@/components/import-panel";

export const metadata = { title: "Settings · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const row = await db.select().from(settings).where(eq(settings.key, "openrouter_api_key"));
  const value = row[0]?.value ?? "";
  const aiSource: "app" | "environment" | null = value
    ? "app"
    : process.env.OPENROUTER_API_KEY
      ? "environment"
      : null;

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

      <SettingsForm configured={!!value} source={aiSource} />
    </main>
  );
}