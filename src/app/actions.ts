"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import { deletePhoto, downloadRemoteImage, savePhoto, savePhotoBytes } from "@/lib/photos";
import { dateField, dollarsToCents, intField, photoFile as readPhoto, requiredText, text } from "@/lib/validation";
import { parseBeanconqueror } from "@/lib/beanconqueror";
import { bestMatch, lookupProductPage, storeFor, storeProducts, type StoreProductDetail } from "@/lib/storefinder";

export type FormState = { message?: string };

export type ImportState = {
  message?: string;
  imported?: number;
  total?: number;
  photosSkipped?: number;
  skipped?: number;
};

export type GridRow = {
  id: number;
  roaster: string;
  name: string;
  origin: string | null;
  variety: string | null;
  process: string | null;
  roastLevel: string | null;
  roastDate: string | null;
  purchaseDate: string | null;
  priceCents: number | null;
  weightGrams: number | null;
  rating: number | null;
  decaffeinated: boolean;
};

export type SaveGridResult = { saved: number; skipped?: number };

/** Batched "spreadsheet" save: full-row write per changed coffee in one transaction. */
export async function saveGrid(rows: GridRow[]): Promise<SaveGridResult> {
  let saved = 0;
  let skipped = 0;
  db.transaction((tx) => {
    for (const row of rows) {
      const roaster = row.roaster.trim();
      const name = row.name.trim();
      if (!roaster || !name) {
        skipped += 1;
        continue;
      }
      const result = tx
        .update(coffees)
        .set({
          roaster,
          name,
          origin: row.origin,
          variety: row.variety,
          process: row.process,
          roastLevel: row.roastLevel,
          roastDate: row.roastDate,
          purchaseDate: row.purchaseDate,
          priceCents: row.priceCents,
          weightGrams: row.weightGrams,
          rating: row.rating,
          decaffeinated: row.decaffeinated,
          updatedAt: new Date(),
        })
        .where(eq(coffees.id, row.id))
        .run();
      if (result.changes > 0) saved += 1;
    }
  });
  revalidatePath("/"); revalidatePath("/coffees");
  revalidatePath("/grid");
  for (const row of rows) revalidatePath(`/coffees/${row.id}`);
  return { saved, skipped: skipped > 0 ? skipped : undefined };
}

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export async function importBeanconqueror(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Choose a Beanconqueror JSON export file." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { message: "File is larger than 50 MB." };
  }

  let parsed;
  try {
    parsed = parseBeanconqueror(await file.text());
  } catch (err) {
    return { message: err instanceof Error ? err.message : "Could not parse this file." };
  }

  if (parsed.beans.length === 0) {
    return { message: "No beans found in this export." };
  }

  const now = new Date();
  let imported = 0;
  for (let i = 0; i < parsed.beans.length; i += 100) {
    const batch = parsed.beans.slice(i, i + 100).map((bean) => ({
      ...bean,
      createdAt: now,
      updatedAt: now,
    }));
    const inserted = await db
      .insert(coffees)
      .values(batch)
      .onConflictDoNothing({ target: coffees.sourceUuid })
      .returning({ id: coffees.id });
    imported += inserted.length;
  }

  revalidatePath("/"); revalidatePath("/coffees");
  return {
    message: "Import finished.",
    imported,
    total: parsed.beans.length,
    photosSkipped: parsed.photoCount,
  };
}

function collect(form: FormData) {
  return {
    roaster: requiredText(form, "roaster"),
    name: requiredText(form, "name"),
    origin: text(form, "origin"),
    variety: text(form, "variety"),
    process: text(form, "process"),
    roastLevel: text(form, "roastLevel"),
    roastDate: dateField(form, "roastDate"),
    purchaseDate: dateField(form, "purchaseDate"),
    priceCents: dollarsToCents(form, "price"),
    weightGrams: intField(form, "weight", 1, 1_000_000),
    rating: intField(form, "rating", 1, 5),
    notes: text(form, "notes"),
    tastingNotes: text(form, "tastingNotes"),
    decaffeinated: form.get("decaffeinated") === "on",
  };
}

type Collected = ReturnType<typeof collect>;

export async function createCoffee(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = collect(formData);
  if (!input.roaster) return { message: "Roaster is required." };
  if (!input.name) return { message: "Coffee name is required." };

  let photo: string | null = null;
  const file = readPhoto(formData);
  if (file) photo = await savePhoto(file);

  const now = new Date();
  const [row] = await db
    .insert(coffees)
    .values({
      roaster: input.roaster,
      name: input.name,
      origin: input.origin,
      variety: input.variety,
      process: input.process,
      roastLevel: input.roastLevel,
      roastDate: input.roastDate,
      purchaseDate: input.purchaseDate,
      priceCents: input.priceCents,
      weightGrams: input.weightGrams,
      rating: input.rating,
      notes: input.notes,
      tastingNotes: input.tastingNotes,
      decaffeinated: input.decaffeinated,
      photoFile: photo,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  revalidatePath("/"); revalidatePath("/coffees");
  redirect(`/coffees/${row.id}`);
}

function fields(input: Collected) {
  return {
    origin: input.origin,
    variety: input.variety,
    process: input.process,
    roastLevel: input.roastLevel,
    roastDate: input.roastDate,
    purchaseDate: input.purchaseDate,
    priceCents: input.priceCents,
    weightGrams: input.weightGrams,
    rating: input.rating,
    notes: input.notes,
    tastingNotes: input.tastingNotes,
    decaffeinated: input.decaffeinated,
  };
}

export async function updateCoffee(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const [existing] = await db.select().from(coffees).where(eq(coffees.id, id));
  if (!existing) return { message: "Coffee not found." };

  const input = collect(formData);
  if (!input.roaster) return { message: "Roaster is required." };
  if (!input.name) return { message: "Coffee name is required." };

  let photo = existing.photoFile;
  const removePhoto = formData.get("removePhoto") === "on";
  const file = readPhoto(formData);
  if (removePhoto && !file) {
    await deletePhoto(existing.photoFile);
    photo = null;
  } else if (file) {
    await deletePhoto(existing.photoFile);
    photo = await savePhoto(file);
  }

  await db
    .update(coffees)
    .set({
      roaster: input.roaster,
      name: input.name,
      ...fields(input),
      photoFile: photo,
      updatedAt: new Date(),
    })
    .where(eq(coffees.id, id));

  revalidatePath("/"); revalidatePath("/coffees");
  revalidatePath(`/coffees/${id}`);
  revalidatePath(`/coffees/${id}/edit`);
  redirect(`/coffees/${id}`);
}

export async function deleteCoffee(id: number): Promise<void> {
  const [existing] = await db.select().from(coffees).where(eq(coffees.id, id));
  if (!existing) return;
  await db.delete(coffees).where(eq(coffees.id, id));
  await deletePhoto(existing.photoFile);
  revalidatePath("/"); revalidatePath("/coffees");
  redirect("/coffees");
}

/* ---------- auto photo lookup (roaster storefront) ---------- */

export type FindPhotoResult =
  | { ok: true; photoFile: string }
  | { ok: false; message: string };
/**
 * Find the store page for this coffee (Shopify /products.json or WooCommerce
 * REST feed), match the bag by fuzzy product-title comparison, and save that
 * product's main image as the coffee photo.
 */
export async function findCoffeePhoto(id: number): Promise<FindPhotoResult> {
  const [coffee] = await db.select().from(coffees).where(eq(coffees.id, id));
  if (!coffee) return { ok: false, message: "Coffee not found." };
  if (coffee.photoFile) return { ok: false, message: "Already has a photo." };

  const store = storeFor(coffee.roaster);
  if (!store) return { ok: false, message: `No store feed found for "${coffee.roaster}".` };

  const products = await storeProducts(store);
  if (products.length === 0) return { ok: false, message: `Could not load ${coffee.roaster}'s products.` };

  const match = bestMatch(coffee.name, products);
  if (!match?.imageUrl) {
    return { ok: false, message: `No product matched "${coffee.name}".` };
  }

  const image = await downloadRemoteImage(match.imageUrl);
  if (!image) return { ok: false, message: "Could not download the product image." };

  let photoFile: string;
  try {
    photoFile = await savePhotoBytes(image.data, image.ext);
  } catch {
    return { ok: false, message: "Could not save the product image." };
  }

  await db.update(coffees).set({ photoFile, updatedAt: new Date() }).where(eq(coffees.id, id));
  revalidatePath("/"); revalidatePath("/coffees");
  revalidatePath("/grid");
  revalidatePath(`/coffees/${id}`);
  return { ok: true, photoFile };
}
/* ---------- add by store link ---------- */

export type LinkLookupResult =
  | { ok: true; url: string; product: StoreProductDetail }
  | { ok: false; message: string };

/** Resolve a store product URL to product + purchase options (bag sizes). */
export async function lookupProductLink(url: string): Promise<LinkLookupResult> {
  const result = await lookupProductPage(url);
  if ("error" in result) return { ok: false, message: result.error };
  return { ok: true, url, product: result };
}

export async function createCoffeeFromLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const url = requiredText(formData, "url");
  const variantIndex = intField(formData, "variantIndex", 0, 1000);
  if (!url || variantIndex === null) return { message: "Missing product link or bag choice." };

  // Re-resolve the product server-side (authoritative; the client only offers choices).
  const page = await lookupProductPage(url);
  if ("error" in page) return { message: page.error };
  const variant = page.variants[variantIndex];
  if (!variant) return { message: "That bag option is not available." };

  const nameOverride = text(formData, "name");
  const priceOverride = dollarsToCents(formData, "price");
  const weightOverride = intField(formData, "weight", 1, 1_000_000);
  const roaster = requiredText(formData, "roaster") ?? page.roaster;
  const name = nameOverride ?? page.name;
  if (!name) return { message: "Coffee name is required." };
  if (!roaster) return { message: "Roaster is required." };

  let photoFile: string | null = null;
  if (page.imageUrl) {
    const image = await downloadRemoteImage(page.imageUrl);
    if (image) {
      try {
        photoFile = await savePhotoBytes(image.data, image.ext);
      } catch {
        photoFile = null;
      }
    }
  }

  const now = new Date();
  const [row] = await db
    .insert(coffees)
    .values({
      roaster,
      name,
      priceCents: priceOverride ?? variant.priceCents ?? null,
      weightGrams: weightOverride ?? variant.weightGrams ?? null,
      notes: text(formData, "notes"),
      photoFile,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  revalidatePath("/"); revalidatePath("/coffees");
  revalidatePath("/grid");
  redirect(`/coffees/${row.id}`);
}

/* ---------- Bean Vault backup restore ---------- */

const MAX_BACKUP_BYTES = 300 * 1024 * 1024;
const ALLOWED_PHOTO_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

type BackupCoffee = {
  id?: unknown;
  roaster?: unknown;
  name?: unknown;
  origin?: unknown;
  variety?: unknown;
  process?: unknown;
  roastLevel?: unknown;
  roastDate?: unknown;
  purchaseDate?: unknown;
  priceCents?: unknown;
  weightGrams?: unknown;
  rating?: unknown;
  notes?: unknown;
  tastingNotes?: unknown;
  decaffeinated?: unknown;
  photoFile?: unknown;
  photo?: { data?: unknown } | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function backupStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function backupNum(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v >= min && v <= max ? Math.round(v) : null;
}

function backupDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Restore a Bean Vault JSON backup. Rows are upserted by id, so re-importing
 * the same backup is idempotent; rows not in the backup are left untouched.
 * Photos embedded in the backup are written back alongside their records.
 */
export async function importBackup(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Choose a Bean Vault backup JSON file." };
  }
  if (file.size > MAX_BACKUP_BYTES) {
    return { message: "Backup file is larger than 300 MB." };
  }

  let root: unknown;
  try {
    root = JSON.parse(await file.text());
  } catch {
    return { message: "Not valid JSON." };
  }
  if (typeof root !== "object" || root === null) return { message: "Not a Bean Vault backup." };
  const rec = root as Record<string, unknown>;
  if (rec.beanVault !== 1 || !Array.isArray(rec.coffees)) {
    return { message: "Not a Bean Vault backup (missing beanVault/coffees)." };
  }

  let created = 0;
  let updated = 0;
  let photos = 0;
  let skipped = 0;

  for (const entry of rec.coffees) {
    if (typeof entry !== "object" || entry === null) {
      skipped += 1;
      continue;
    }
    const c = entry as BackupCoffee;
    const id = backupNum(c.id, 1, 1_000_000_000);
    const roaster = backupStr(c.roaster);
    const name = backupStr(c.name);
    if (id === null || !roaster || !name) {
      skipped += 1;
      continue;
    }

    // Write the embedded photo first (idempotent: same bytes, same name).
    let photoFile = backupStr(c.photoFile);
    if (c.photo && typeof c.photo.data === "string" && photoFile) {
      const ext = photoFile.split(".").pop()?.toLowerCase() ?? "";
      if (ALLOWED_PHOTO_EXTS.has(ext) && c.photo.data.length > 0) {
        try {
          const raw = Buffer.from(c.photo.data, "base64");
          if (raw.length > 0 && raw.length <= 12 * 1024 * 1024) {
            await savePhotoBytes(raw, ext === "jpeg" ? "jpg" : ext);
            photos += 1;
          } else {
            photoFile = null;
          }
        } catch {
          photoFile = null;
        }
      } else {
        photoFile = null;
      }
    }

    const createdAt = backupDate(c.createdAt) ?? new Date();
    const updatedAt = backupDate(c.updatedAt) ?? new Date();
    const existing = await db.select().from(coffees).where(eq(coffees.id, id));

    const values = {
      roaster,
      name,
      origin: backupStr(c.origin),
      variety: backupStr(c.variety),
      process: backupStr(c.process),
      roastLevel: backupStr(c.roastLevel),
      roastDate: backupStr(c.roastDate),
      purchaseDate: backupStr(c.purchaseDate),
      priceCents: backupNum(c.priceCents, 0, 100_000_000),
      weightGrams: backupNum(c.weightGrams, 1, 1_000_000),
      rating: backupNum(c.rating, 1, 5),
      notes: backupStr(c.notes),
      tastingNotes: backupStr(c.tastingNotes),
    };

    if (existing.length > 0) {
      await db
        .update(coffees)
        .set({
          ...values,
          // Only replace the photo when the backup embeds one.
          photoFile: photoFile ?? existing[0].photoFile,
          updatedAt,
        })
        .where(eq(coffees.id, id));
      updated += 1;
    } else {
      await db.insert(coffees).values({
        id,
        ...values,
        photoFile,
        createdAt,
        updatedAt,
      });
      created += 1;
    }
  }

  revalidatePath("/"); revalidatePath("/coffees");
  revalidatePath("/grid");
  revalidatePath("/dashboard");
  return {
    message: "Backup restored.",
    imported: created,
    total: created + updated,
    photosSkipped: photos,
    skipped,
  };
}
