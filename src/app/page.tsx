import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import Dashboard from "@/components/dashboard";

export const metadata = { title: "Dashboard · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rows = await db
    .select({
      id: coffees.id,
      name: coffees.name,
      roaster: coffees.roaster,
      country: coffees.country,
      process: coffees.process,
      roastLevel: coffees.roastLevel,
      roastDate: coffees.roastDate,
      purchaseDate: coffees.purchaseDate,
      createdAt: coffees.createdAt,
      priceCents: coffees.priceCents,
      weightGrams: coffees.weightGrams,
      rating: coffees.rating,
      decaffeinated: coffees.decaffeinated,
      photoFile: coffees.photoFile,
    })
    .from(coffees)
    .orderBy(desc(coffees.roastDate));

  return (
    <main className="page page-wide">
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>
      <Dashboard
        rows={rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString().slice(0, 10),
        }))}
      />
    </main>
  );
}