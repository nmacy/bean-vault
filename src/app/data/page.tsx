import Link from "next/link";
import ImportPanel from "@/components/import-panel";

export const metadata = { title: "Data · Bean Vault" };

export default function DataPage() {
  return (
    <main className="page page-narrow">
      <Link href="/coffees" className="back-link">← Back to coffees</Link>
      <div className="page-head">
        <h1>Data</h1>
      </div>
      <p className="grid-intro">
        Get your coffees out, or bring new ones in. Backups carry every photo;
        CSV is the plain table for spreadsheets.
      </p>

      <section className="form-card data-export-card">
        <h2 className="link-heading">Export</h2>
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
    </main>
  );
}