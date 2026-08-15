import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import GridEditor from "@/components/grid-editor";

export const metadata = { title: "Edit grid · Coffee Tracker" };
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
        Edit any cell, then save once. Changed cells are highlighted until saved.
        Click a photo to open that coffee.
      </p>
      <GridEditor beans={all.map((b) => ({ ...b }))} />
    </main>
  );
}