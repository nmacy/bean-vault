import { readFile } from "node:fs/promises";
import path from "node:path";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coffees, roasters } from "@/db/schema";
import { UPLOAD_DIR } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** Read a stored photo/logo file as base64, or null if missing/unreadable/too large. */
async function embedPhoto(file: string | null): Promise<{ data: string } | null> {
  if (!file) return null;
  try {
    const buffer = await readFile(path.join(UPLOAD_DIR, file));
    return buffer.length > 0 && buffer.length <= 50 * 1024 * 1024 ? { data: buffer.toString("base64") } : null;
  } catch {
    return null;
  }
}

/** JSON backup: every coffee plus its photo, and every roaster plus its logo, embedded as base64. */
export async function GET() {
  const rows = await db.select().from(coffees).orderBy(desc(coffees.createdAt));
  const roasterRows = await db.select().from(roasters).orderBy(roasters.name);

  const roasterRecords = [];
  for (const r of roasterRows) {
    roasterRecords.push({
      id: r.id,
      name: r.name,
      website: r.website,
      city: r.city,
      state: r.state,
      country: r.country,
      description: r.description,
      specialty: r.specialty,
      foundedYear: r.foundedYear,
      aiEnriched: r.aiEnriched,
      sourceUrl: r.sourceUrl,
      logoFile: r.logoFile,
      logo: await embedPhoto(r.logoFile),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    });
  }

  const records = [];
  for (const r of rows) {
    const photo = await embedPhoto(r.photoFile);
    records.push({
      id: r.id,
      roaster: r.roaster,
      name: r.name,
      country: r.country,
      region: r.region,
      mix: r.mix,
      variety: r.variety,
      producer: r.producer,
      elevation: r.elevation,
      process: r.process,
      roastLevel: r.roastLevel,
      roastDate: r.roastDate,
      purchaseDate: r.purchaseDate,
      priceCents: r.priceCents,
      weightGrams: r.weightGrams,
      rating: r.rating,
      notes: r.notes,
      tastingNotes: r.tastingNotes,
      decaffeinated: r.decaffeinated,
      aiEnriched: r.aiEnriched,
      photoFile: r.photoFile,
      photo,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    });
  }

  const payload = {
    beanVault: 1,
    exportedAt: new Date().toISOString(),
    roasters: roasterRecords,
    coffees: records,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bean-vault-backup.json"',
      "Cache-Control": "no-store",
    },
  });
}