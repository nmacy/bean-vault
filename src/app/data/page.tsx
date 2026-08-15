import Link from "next/link";
import ImportForm from "@/components/import-form";

export const metadata = { title: "Data · Bean Vault" };

export default function DataPage() {
  return (
    <main className="page">
      <Link href="/coffees" className="back-link">← Back to all coffees</Link>
      <div className="page-head">
        <h1>Data</h1>
      </div>
      <div className="data-export">
        <h2 className="link-heading">Export</h2>
        <div className="data-export-actions">
          <a href="/api/export" className="btn">
            Download CSV (data only)
          </a>
          <a href="/api/export/json" className="btn">
            Download backup (with photos)
          </a>
        </div>
        <p className="link-hint">
          CSV is for spreadsheets; the JSON backup includes every photo and restores
          into this app on the Import side below.
        </p>
      </div>
      <ImportForm />
    </main>
  );
}