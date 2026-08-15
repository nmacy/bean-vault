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
      photoFile: coffees.photoFile,
    })
    .from(coffees)
    .orderBy(desc(coffees.createdAt));

  return (
    <main className="page page-wide">
      <Link href="/" className="back-link">← Back to all coffees</Link>
      <div className="page-head">
        <h1>Edit all ({all.length})</h1>
        <Link href="/" className="btn secondary">View cards</Link>
      </div>
      <p className="grid-intro">
        Edit any cell — changes save automatically when you leave the cell.
        Click column headers to sort; use the filters to narrow the list.
      </p>
      <GridEditor beans={all.map((b) => ({ ...b }))} />
    </main>
  );
}