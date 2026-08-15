import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import { formatCents } from "@/lib/format";

export const dynamic = "force-dynamic";

function csvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: (string | null | undefined)[]): string {
  return fields.map(csvField).join(",") + "\r\n";
}

export async function GET() {
  const rows = await db.select().from(coffees).orderBy(desc(coffees.createdAt));

  const header = [
    "id", "roaster", "name", "country", "region", "mix", "variety", "producer", "elevation", "process", "roast_level",
    "roast_date", "purchase_date", "tasting_notes", "notes", "price_usd",
    "weight_grams", "rating", "decaffeinated", "ai_enriched", "photo", "added_at",
  ];
  let csv = csvRow(header);
  for (const r of rows) {
    csv += csvRow([
      String(r.id),
      r.roaster,
      r.name,
      r.country,
      r.region,
      r.mix,
      r.variety,
      r.producer,
      r.elevation,
      r.process,
      r.roastLevel,
      r.roastDate,
      r.purchaseDate,
      r.tastingNotes,
      r.notes,
      r.priceCents != null ? formatCents(r.priceCents) : null,
      r.weightGrams != null ? String(r.weightGrams) : null,
      r.rating != null ? String(r.rating) : null,
      r.decaffeinated ? "yes" : "no",
      r.aiEnriched ? "yes" : "no",
      r.photoFile,
      r.createdAt.toISOString(),
    ]);
  }

  // UTF-8 BOM so spreadsheet apps detect the encoding.
  const bytes = new TextEncoder().encode("\uFEFF" + csv);
  return new Response(bytes, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bean-vault-export.csv"',
      "Cache-Control": "no-store",
    },
  });
}