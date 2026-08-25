/**
 * Shared roaster lookup/creation. A roaster is found-or-created by
 * case-insensitive exact name match — this mirrors the distinct-roaster-name
 * aggregation the coffees list already does client-side. Never overwrites an
 * existing roaster's data; only touches name/timestamps on first creation.
 */

import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { coffees, roasters } from "@/db/schema";

export async function findRoasterByName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const [row] = await db
    .select()
    .from(roasters)
    .where(sql`lower(${roasters.name}) = lower(${trimmed})`);
  return row ?? null;
}

/** Find-or-create a roaster by name. Returns its id and whether it was just created. */
export async function ensureRoaster(name: string): Promise<{ id: number; created: boolean }> {
  const trimmed = name.trim();
  const existing = await findRoasterByName(trimmed);
  if (existing) return { id: existing.id, created: false };

  const now = new Date();
  const inserted = await db
    .insert(roasters)
    .values({ name: trimmed, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: roasters.name })
    .returning({ id: roasters.id });
  if (inserted.length > 0) return { id: inserted[0].id, created: true };

  // Lost a race between the lookup and the insert — someone else just created it.
  const row = await findRoasterByName(trimmed);
  if (!row) throw new Error(`Could not find or create roaster "${trimmed}".`);
  return { id: row.id, created: false };
}

/** Batch find-or-create for bulk-import paths. Returns a lowercase-name -> id map. */
export async function ensureRoasters(names: string[]): Promise<Map<string, number>> {
  const trimmed = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (trimmed.length === 0) return new Map();

  const lowerNames = trimmed.map((n) => n.toLowerCase());
  const existingRows = await db
    .select()
    .from(roasters)
    .where(inArray(sql`lower(${roasters.name})`, lowerNames));
  const byLower = new Map(existingRows.map((r) => [r.name.toLowerCase(), r.id]));

  const missing = trimmed.filter((n) => !byLower.has(n.toLowerCase()));
  if (missing.length > 0) {
    const now = new Date();
    await db
      .insert(roasters)
      .values(missing.map((name) => ({ name, createdAt: now, updatedAt: now })))
      .onConflictDoNothing({ target: roasters.name });
    const inserted = await db
      .select()
      .from(roasters)
      .where(inArray(sql`lower(${roasters.name})`, missing.map((n) => n.toLowerCase())));
    for (const r of inserted) byLower.set(r.name.toLowerCase(), r.id);
  }

  return byLower;
}

/** Rename a roaster and cascade the change to every coffee referencing it. */
export async function renameRoasterCoffees(roasterId: number, oldName: string, newName: string): Promise<void> {
  db.transaction((tx) => {
    tx.update(coffees)
      .set({ roaster: newName, updatedAt: new Date() })
      .where(sql`${coffees.roasterId} = ${roasterId} or lower(${coffees.roaster}) = lower(${oldName})`)
      .run();
  });
}

/** Count of coffees still referencing a roaster (by id or by name, for pre-FK rows). */
export async function countRoasterCoffees(roasterId: number, name: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(coffees)
    .where(sql`${coffees.roasterId} = ${roasterId} or lower(${coffees.roaster}) = lower(${name})`);
  return row?.count ?? 0;
}
