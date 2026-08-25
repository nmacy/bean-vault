import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { coffees, roasters } from "@/db/schema";
import RoastersView, { type RoasterItem } from "@/components/roasters-view";

export const metadata = { title: "Roasters · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function RoastersPage() {
  const rows = await db
    .select({
      id: roasters.id,
      name: roasters.name,
      website: roasters.website,
      state: roasters.state,
      country: roasters.country,
      description: roasters.description,
      specialty: roasters.specialty,
      foundedYear: roasters.foundedYear,
      logoFile: roasters.logoFile,
      aiEnriched: roasters.aiEnriched,
      coffeeCount: sql<number>`count(${coffees.id})`,
    })
    .from(roasters)
    .leftJoin(coffees, eq(coffees.roasterId, roasters.id))
    .groupBy(roasters.id)
    .orderBy(roasters.name);

  return (
    <main className="page">
      <RoastersView roasters={rows as RoasterItem[]} />
    </main>
  );
}
