import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import GridEditor from "@/components/grid-editor";

export const metadata = { title: "Edit grid · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function GridPage() {
  const all = await db
    .select({
      id: coffees.id,
      roaster: coffees.roaster,
      name: coffees.name,
      origin: coffees.origin,
      variety: coffees.variety,
      process: coffees.process,
      roastLevel: coffees.roastLevel,
      roastDate: coffees.roastDate,
      purchaseDate: coffees.purchaseDate,
      priceCents: coffees.priceCents,
      weightGrams: coffees.weightGrams,
      rating: coffees.rating,
      decaffeinated: coffees.decaffeinated,
      photoFile: coffees.photoFile,
    })
    .from(coffees)
    .orderBy(desc(coffees.createdAt));

  return (
    <main className="page page-wide">
      <Link href="/coffees" className="back-link">← Back to all coffees</Link>
      <div className="page-head">
        <h1>Edit all ({all.length})</h1>
        <Link href="/coffees" className="btn secondary">View cards</Link>
      </div>
      <p className="grid-intro">
        Browse every bag here; click <strong>Edit</strong> to change cells (edits save
        automatically as you leave each one). Column headers sort; the filters narrow the list.
      </p>
      <GridEditor beans={all.map((b) => ({ ...b }))} />
    </main>
  );
}