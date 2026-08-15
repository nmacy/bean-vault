"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import { deletePhoto, savePhoto, savePhotoBytes } from "@/lib/photos";
import { dateField, dollarsToCents, intField, photoFile as readPhoto, requiredText, text } from "@/lib/validation";
import { parseBeanconqueror } from "@/lib/beanconqueror";
import { bestMatch, storeFor, storeProducts } from "@/lib/storefinder";

export type FormState = { message?: string };

export type ImportState = {
  message?: string;
  imported?: number;
  total?: number;
  photosSkipped?: number;
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
          updatedAt: new Date(),
        })
        .where(eq(coffees.id, row.id))
        .run();
      if (result.changes > 0) saved += 1;
    }
  });
  revalidatePath("/");
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

  revalidatePath("/");
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
      photoFile: photo,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  revalidatePath("/");
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

  revalidatePath("/");
  revalidatePath(`/coffees/${id}`);
  revalidatePath(`/coffees/${id}/edit`);
  redirect(`/coffees/${id}`);
}

export async function deleteCoffee(id: number): Promise<void> {
  const [existing] = await db.select().from(coffees).where(eq(coffees.id, id));
  if (!existing) return;
  await db.delete(coffees).where(eq(coffees.id, id));
  await deletePhoto(existing.photoFile);
  revalidatePath("/");
  redirect("/");
}

/* ---------- auto photo lookup (roaster storefront) ---------- */

export type FindPhotoResult =
  | { ok: true; photoFile: string }
  | { ok: false; message: string };

const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

async function downloadImage(url: string): Promise<{ data: Uint8Array; ext: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const buffer = new Uint8Array(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_DOWNLOAD_BYTES) return null;
    const urlExt = url.match(/\.(jpe?g|png|webp|gif|avif)(?:[?#]|$)/i)?.[1].toLowerCase().replace("jpeg", "jpg");
    const resolvedExt = MIME_EXT[contentType] ?? urlExt;
    return resolvedExt ? { data: buffer, ext: resolvedExt } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

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

  const image = await downloadImage(match.imageUrl);
  if (!image) return { ok: false, message: "Could not download the product image." };

  let photoFile: string;
  try {
    photoFile = await savePhotoBytes(image.data, image.ext);
  } catch {
    return { ok: false, message: "Could not save the product image." };
  }

  await db.update(coffees).set({ photoFile, updatedAt: new Date() }).where(eq(coffees.id, id));
  revalidatePath("/");
  revalidatePath("/grid");
  revalidatePath(`/coffees/${id}`);
  return { ok: true, photoFile };
}