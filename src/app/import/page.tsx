import Link from "next/link";
import ImportForm from "@/components/import-form";

export const metadata = { title: "Import · Coffee Tracker" };

export default function ImportPage() {
  return (
    <main className="page">
      <Link href="/" className="back-link">← Back to all coffees</Link>
      <div className="page-head">
        <h1>Import from Beanconqueror</h1>
      </div>
      <ImportForm />
    </main>
  );
}