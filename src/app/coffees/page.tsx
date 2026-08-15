import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import CollectionView, { type BeanItem } from "@/components/collection-view";

export const metadata = { title: "Coffees · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function CoffeesPage() {
  const rows = await db
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
    <main className="page">
      <CollectionView beans={rows as BeanItem[]} />
    </main>
  );
}