import { readFile } from "node:fs/promises";
import path from "node:path";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import { UPLOAD_DIR } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** JSON backup: every coffee plus its photo embedded as base64. */
export async function GET() {
  const rows = await db.select().from(coffees).orderBy(desc(coffees.createdAt));

  const records = [];
  for (const r of rows) {
    let photo: { data: string } | null = null;
    if (r.photoFile) {
      try {
        const buffer = await readFile(path.join(UPLOAD_DIR, r.photoFile));
        if (buffer.length > 0 && buffer.length <= 50 * 1024 * 1024) {
          photo = { data: buffer.toString("base64") };
        }
      } catch {
        photo = null;
      }
    }
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