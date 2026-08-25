"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coffees, roasters, settings } from "@/db/schema";
import { deletePhoto, downloadFirstWorkingImage, downloadRemoteImage, savePhoto, savePhotoBytes } from "@/lib/photos";
import { dateField, dollarsToCents, elevationField, intField, photoFile as readPhoto, requiredText, text } from "@/lib/validation";
import { parseBeanconqueror } from "@/lib/beanconqueror";
import { bestMatch, lookupProductPage, storeFor, storeProducts, type StoreProductDetail } from "@/lib/storefinder";
import { parseCsv } from "@/lib/csv";
import {
  analyzeCoffeePhoto,
  DEFAULT_MODEL,
  enrichCoffeePage,
  enrichRoasterPage,
  fetchPageMeta,
  mergePhotoAndPageFields,
  type AiCoffeeFields,
  type AiRoasterFields,
  type PhotoFields,
} from "@/lib/ai";
import { addApiKey as storeApiKey, revokeApiKey as dropApiKey } from "@/lib/api-auth";
import { isValidPhotoName, UPLOAD_DIR } from "@/lib/photos";
import { countRoasterCoffees, ensureRoaster, ensureRoasters, renameRoasterCoffees } from "@/lib/roasters";
import { canTransition, deriveStatus, toBeanStatus, todayStr, type BeanStatus } from "@/lib/status";
import { existsSync } from "node:fs";
import path from "node:path";

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
  country: string | null;
  region: string | null;
  mix: string | null;
  variety: string | null;
  producer: string | null;
  elevation: string | null;
  process: string | null;
  roastLevel: string | null;
  roastDate: string | null;
  purchaseDate: string | null;
  openedAt: string | null;
  frozenAt: string | null;
  unfrozenAt: string | null;
  emptiedAt: string | null;
  priceCents: number | null;
  weightGrams: number | null;
  rating: number | null;
  decaffeinated: boolean;
};

export type SaveGridResult = { saved: number; skipped?: number };

function joinOrigin(country: string | null, region: string | null): string | null {
  return [country, region].filter((v): v is string => v !== null && v.length > 0).join(", ") || null;
}

function splitOrigin(origin: string | null): { country: string | null; region: string | null } {
  if (!origin) return { country: null, region: null };
  const comma = origin.indexOf(",");
  if (comma > 0) {
    return { country: origin.slice(0, comma).trim() || null, region: origin.slice(comma + 1).trim() || null };
  }
  return { country: origin.trim() || null, region: null };
}

/** Batched "spreadsheet" save: full-row write per changed coffee in one transaction. */
export async function saveGrid(rows: GridRow[]): Promise<SaveGridResult> {
  let saved = 0;
  let skipped = 0;
  const roasterIds = await ensureRoasters(rows.map((r) => r.roaster));
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
          roasterId: roasterIds.get(roaster.toLowerCase()) ?? null,
          name,
          country: row.country,
          region: row.region,
          mix: row.mix,
          origin: joinOrigin(row.country, row.region),
          variety: row.variety,
          producer: row.producer,
          elevation: row.elevation,
          process: row.process,
          roastLevel: row.roastLevel,
          roastDate: row.roastDate,
          purchaseDate: row.purchaseDate,
          openedAt: row.openedAt,
          frozenAt: row.frozenAt,
          unfrozenAt: row.unfrozenAt,
          emptiedAt: row.emptiedAt,
          status: deriveStatus(row),
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
  revalidatePath("/coffees");
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
  const roasterIds = await ensureRoasters(parsed.beans.map((b) => b.roaster));
  let imported = 0;
  for (let i = 0; i < parsed.beans.length; i += 100) {
    const batch = parsed.beans.slice(i, i + 100).map((bean) => ({
      ...bean,
      roasterId: roasterIds.get(bean.roaster.trim().toLowerCase()) ?? null,
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
  const priceCents = dollarsToCents(form, "price");
  const weightGrams = intField(form, "weight", 1, 1_000_000);
  const elevation = elevationField(form, "elevation");
  const errors: string[] = [];
  if (text(form, "price") !== null && priceCents === null) {
    errors.push("Price must be a number (no commas or units).");
  }
  if (text(form, "weight") !== null && weightGrams === null) {
    errors.push("Weight must be a whole number in grams (no commas or units).");
  }
  if (text(form, "elevation") !== null && elevation === null) {
    errors.push("Elevation must be numbers only (no units), e.g. 1,900–2,100.");
  }
  return {
    roaster: requiredText(form, "roaster"),
    name: requiredText(form, "name"),
    country: text(form, "country"),
    region: text(form, "region"),
    mix: text(form, "mix"),
    variety: text(form, "variety"),
    producer: text(form, "producer"),
    elevation,
    process: text(form, "process"),
    roastLevel: text(form, "roastLevel"),
    roastDate: dateField(form, "roastDate"),
    purchaseDate: dateField(form, "purchaseDate"),
    openedAt: dateField(form, "openedAt"),
    emptiedAt: dateField(form, "emptiedAt"),
    frozenAt: dateField(form, "frozenAt"),
    unfrozenAt: dateField(form, "unfrozenAt"),
    priceCents,
    weightGrams,
    rating: intField(form, "rating", 1, 5),
    notes: text(form, "notes"),
    tastingNotes: text(form, "tastingNotes"),
    decaffeinated: form.get("decaffeinated") === "on",
    errors,
  };
}

type Collected = ReturnType<typeof collect>;

export async function createCoffee(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = collect(formData);
  if (input.errors.length > 0) return { message: input.errors[0] };
  if (!input.roaster) return { message: "Roaster is required." };
  if (!input.name) return { message: "Coffee name is required." };

  let photo: string | null = null;
  const file = readPhoto(formData);
  if (file) photo = await savePhoto(file);

  const { id: roasterId } = await ensureRoaster(input.roaster);
  const now = new Date();
  const [row] = await db
    .insert(coffees)
    .values({
      roaster: input.roaster,
      roasterId,
      name: input.name,
      country: input.country,
      region: input.region,
      mix: input.mix,
      origin: joinOrigin(input.country, input.region),
      variety: input.variety,
      producer: input.producer,
      elevation: input.elevation,
      process: input.process,
      roastLevel: input.roastLevel,
      roastDate: input.roastDate,
      purchaseDate: input.purchaseDate,
      openedAt: input.openedAt,
      emptiedAt: input.emptiedAt,
      frozenAt: input.frozenAt,
      unfrozenAt: input.unfrozenAt,
      status: deriveStatus(input),
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
    country: input.country,
    region: input.region,
    mix: input.mix,
    variety: input.variety,
    producer: input.producer,
    elevation: input.elevation,
    process: input.process,
    roastLevel: input.roastLevel,
    roastDate: input.roastDate,
    purchaseDate: input.purchaseDate,
    openedAt: input.openedAt,
    emptiedAt: input.emptiedAt,
    frozenAt: input.frozenAt,
    unfrozenAt: input.unfrozenAt,
    status: deriveStatus(input),
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
  if (input.errors.length > 0) return { message: input.errors[0] };
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

  const { id: roasterId } = await ensureRoaster(input.roaster);
  await db
    .update(coffees)
    .set({
      roaster: input.roaster,
      roasterId,
      name: input.name,
      ...fields(input),
      origin: joinOrigin(input.country, input.region),
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

/* ---------- lifecycle status (resting / frozen / opened / empty) ---------- */

/**
 * Transition a bag to `target`. The state machine (see src/lib/status.ts)
 * guards legal transitions; illegal ones are no-ops. Date bookkeeping:
 *
 * - a bag is assumed to be frozen at most once; `unfrozenAt` marks the end
 *   of that span and `restingDays` derives frozen time straight from
 *   frozenAt/unfrozenAt rather than a running counter
 * - `openedAt` sticks to the first open; `emptiedAt` is terminal
 */
export async function setCoffeeStatus(id: number, target: BeanStatus): Promise<void> {
  const [existing] = await db.select().from(coffees).where(eq(coffees.id, id));
  if (!existing) return;

  const from = toBeanStatus(existing.status);
  if (!canTransition(from, target)) return;

  const today = todayStr();
  const patch: Partial<typeof coffees.$inferSelect> = { status: target };

  switch (target) {
    case "opened":
      patch.openedAt = existing.openedAt ?? today;
      patch.unfrozenAt = null; // opening ends any freeze display
      break;
    case "frozen":
      patch.frozenAt = today;
      patch.unfrozenAt = null;
      break;
    case "resting":
      if (from === "frozen") patch.unfrozenAt = today;
      if (from === "empty") patch.emptiedAt = null; // undo mistaken empty
      break;
    case "empty":
      if (from === "frozen") patch.unfrozenAt = today;
      patch.emptiedAt = today;
      break;
  }

  await db
    .update(coffees)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(coffees.id, id));
  revalidatePath("/"); revalidatePath("/coffees");
  revalidatePath(`/coffees/${id}`);
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
  revalidatePath("/coffees");
  revalidatePath(`/coffees/${id}`);
  return { ok: true, photoFile };
}
/* ---------- add by store link ---------- */

export type LinkLookupResult =
  | { ok: true; url: string; product: StoreProductDetail; aiOnly?: boolean }
  | { ok: false; message: string };

/** Resolve a store product URL to product + purchase options (bag sizes). */
export async function lookupProductLink(url: string): Promise<LinkLookupResult> {
  const result = await lookupProductPage(url);
  if (!("error" in result)) return { ok: true, url, product: result };
  // No feed: read the page directly (og:title/og:image). Ask AI later for details.
  const fallback = await aiPageProduct(url);
  if (!fallback) return { ok: false, message: result.error };
  return { ok: true, url, product: fallback, aiOnly: true };
}

export async function createCoffeeFromLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const url = requiredText(formData, "url");
  const variantIndex = intField(formData, "variantIndex", 0, 1000);
  if (!url || variantIndex === null) return { message: "Missing product link or bag choice." };

  // Re-resolve the product server-side (authoritative; the client only offers choices).
  // Feed-less stores fall back to the page's own metadata and form values.
  const page = await lookupProductPage(url);
  let variant: { priceCents: number | null; weightGrams: number | null } | null = null;
  if (!("error" in page) && page.variants[variantIndex]) {
    variant = page.variants[variantIndex];
  } else if (!("error" in page)) {
    return { message: "That bag option is not available." };
  }

  const nameOverride = text(formData, "name");
  const priceOverride = dollarsToCents(formData, "price");
  const weightOverride = intField(formData, "weight", 1, 1_000_000);
  const elevation = elevationField(formData, "elevation");
  if (text(formData, "price") !== null && priceOverride === null) {
    return { message: "Price must be a number (no commas or units)." };
  }
  if (text(formData, "weight") !== null && weightOverride === null) {
    return { message: "Weight must be a whole number in grams (no commas or units)." };
  }
  if (text(formData, "elevation") !== null && elevation === null) {
    return { message: "Elevation must be numbers only (no units), e.g. 1,900–2,100." };
  }
  const country = text(formData, "country");
  const region = text(formData, "region");
  const variety = text(formData, "variety");
  const producer = text(formData, "producer");
  const process = text(formData, "process");
  const roastLevel = text(formData, "roastLevel");
  const tastingNotes = text(formData, "tastingNotes");
  const decaf = formData.get("decaffeinated") === "on";
  const aiUsed = formData.get("aiUsed") === "on";
  const roaster = requiredText(formData, "roaster") ?? ("error" in page ? null : page.roaster);
  const name = nameOverride ?? ("error" in page ? null : page.name);
  if (!name) return { message: "Coffee name is required." };
  if (!roaster) return { message: "Roaster is required." };

  let pageImage: string | null = null;
  if ("error" in page) {
    const meta = await fetchPageMeta(url);
    pageImage = meta.image;
  } else {
    pageImage = page.imageUrl;
  }

  let photoFile: string | null = null;
  if (pageImage) {
    const image = await downloadRemoteImage(pageImage);
    if (image) {
      try {
        photoFile = await savePhotoBytes(image.data, image.ext);
      } catch {
        photoFile = null;
      }
    }
  }

  const { id: roasterId, created: roasterCreated } = await ensureRoaster(roaster);

  const now = new Date();
  const [row] = await db
    .insert(coffees)
    .values({
      roaster,
      roasterId,
      name,
      country,
      region,
      mix: text(formData, "mix"),
      origin: joinOrigin(country, region),
      variety,
      producer,
      elevation,
      process,
      roastLevel,
      tastingNotes,
      decaffeinated: decaf,
      aiEnriched: aiUsed,
      priceCents: priceOverride ?? variant?.priceCents ?? null,
      weightGrams: weightOverride ?? variant?.weightGrams ?? null,
      notes: text(formData, "notes"),
      photoFile,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Fill the newly-created roaster's profile from the same page the AI just
  // read, when the link-import flow ran AI and had something to say — plus a
  // logo, which needs no AI key at all (the site's own icon/apple-touch-icon
  // is scraped straight off the page, a better "roaster logo" guess than the
  // product photo). Never touches a roaster that already existed.
  if (roasterCreated) {
    const roasterState = text(formData, "roasterState");
    const roasterCountry = text(formData, "roasterCountry");
    const roasterDescription = text(formData, "roasterDescription");
    const roasterFoundedYear = intField(formData, "roasterFoundedYear", 1600, 2100);
    const roasterSpecialty = text(formData, "roasterSpecialty");
    const hasAiFields = Boolean(
      roasterState || roasterCountry || roasterDescription || roasterFoundedYear || roasterSpecialty,
    );

    const roasterMeta = await fetchPageMeta(url);
    const roasterLogoCandidates = [...roasterMeta.icons, roasterMeta.image].filter(
      (u): u is string => u !== null,
    );
    let roasterLogoFile: string | null = null;
    if (roasterLogoCandidates.length > 0) {
      const image = await downloadFirstWorkingImage(roasterLogoCandidates);
      if (image) {
        try {
          roasterLogoFile = await savePhotoBytes(image.data, image.ext);
        } catch {
          roasterLogoFile = null;
        }
      }
    }

    if (hasAiFields || roasterLogoFile) {
      const roasterChanges: Partial<typeof roasters.$inferInsert> = { updatedAt: new Date() };
      if (roasterState) roasterChanges.state = roasterState;
      if (roasterCountry) roasterChanges.country = roasterCountry;
      if (roasterDescription) roasterChanges.description = roasterDescription;
      if (roasterFoundedYear) roasterChanges.foundedYear = roasterFoundedYear;
      if (roasterSpecialty) roasterChanges.specialty = roasterSpecialty;
      if (roasterLogoFile) roasterChanges.logoFile = roasterLogoFile;
      if (hasAiFields) {
        roasterChanges.aiEnriched = true;
        roasterChanges.sourceUrl = url;
      }
      await db.update(roasters).set(roasterChanges).where(eq(roasters.id, roasterId));
    }
  }

  revalidatePath("/"); revalidatePath("/coffees"); revalidatePath("/roasters");
  redirect(`/coffees/${row.id}`);
}

/* ---------- Bean Vault backup restore ---------- */

const MAX_BACKUP_BYTES = 300 * 1024 * 1024;
const ALLOWED_PHOTO_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

type BackupCoffee = {
  id?: unknown;
  roaster?: unknown;
  name?: unknown;
  origin?: unknown; // legacy combined value
  country?: unknown;
  region?: unknown;
  mix?: unknown;
  variety?: unknown;
  producer?: unknown;
  elevation?: unknown;
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

  const roasterIds = await ensureRoasters(
    rec.coffees
      .map((entry) => (typeof entry === "object" && entry !== null ? backupStr((entry as BackupCoffee).roaster) : null))
      .filter((r): r is string => r !== null),
  );

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
    const roasterId = roasterIds.get(roaster.trim().toLowerCase()) ?? null;

    // Write the embedded photo first (idempotent: same bytes, same name).
    let photoFile = backupStr(c.photoFile);
    if (c.photo && typeof c.photo.data === "string" && photoFile) {
      const ext = photoFile.split(".").pop()?.toLowerCase() ?? "";
      if (ALLOWED_PHOTO_EXTS.has(ext) && c.photo.data.length > 0) {
        try {
          const raw = Buffer.from(c.photo.data, "base64");
          if (raw.length > 0 && raw.length <= 12 * 1024 * 1024) {
            // The DB must reference the actual filename: keep the generated name.
            photoFile = await savePhotoBytes(raw, ext === "jpeg" ? "jpg" : ext);
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

    const backupCountry = backupStr(c.country) ?? splitOrigin(backupStr(c.origin)).country;
    const backupRegion = backupStr(c.region) ?? splitOrigin(backupStr(c.origin)).region;
    const values = {
      roaster,
      roasterId,
      name,
      country: backupCountry,
      region: backupRegion,
      mix: backupStr(c.mix),
      origin: joinOrigin(backupCountry, backupRegion),
      variety: backupStr(c.variety),
      producer: backupStr(c.producer),
      elevation: backupStr(c.elevation),
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
  revalidatePath("/coffees");
  revalidatePath("/dashboard");
  return {
    message: "Backup restored.",
    imported: created,
    total: created + updated,
    photosSkipped: photos,
    skipped,
  };
}

/* ---------- Bean Vault CSV import ---------- */

const MAX_CSV_BYTES = 50 * 1024 * 1024;

function csvCell(row: string[], index: number): string {
  return index >= 0 && index < row.length ? row[index].trim() : "";
}

function csvNum(v: string): number | null {
  if (v === "") return null;
  const n = Number(v.replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Import a Bean Vault CSV export. Rows with a valid id update that coffee,
 * everything else inserts a new one (later rows win for duplicate ids).
 * The photo column is only honoured when the file exists in uploads/.
 */
export async function importBeanVaultCsv(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Choose a Bean Vault CSV file." };
  }
  if (file.size > MAX_CSV_BYTES) {
    return { message: "CSV file is larger than 50 MB." };
  }

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { message: "The CSV has no data rows." };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const col = {
    id: idx("id"),
    roaster: idx("roaster"),
    name: idx("name"),
    country: idx("country"),
    region: idx("region"),
    mix: idx("mix"),
    origin: idx("origin"),
    variety: idx("variety"),
    producer: idx("producer"),
    elevation: idx("elevation"),
    process: idx("process"),
    roastLevel: idx("roast_level"),
    roastDate: idx("roast_date"),
    purchaseDate: idx("purchase_date"),
    tastingNotes: idx("tasting_notes"),
    notes: idx("notes"),
    price: idx("price_usd"),
    weight: idx("weight_grams"),
    rating: idx("rating"),
    decaf: idx("decaffeinated"),
    aiEnriched: idx("ai_enriched"),
    photo: idx("photo"),
  };
  if (col.roaster < 0 || col.name < 0) {
    return { message: "That CSV does not have roaster and name columns." };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let photosMissing = 0;

  const roasterIds = await ensureRoasters(rows.slice(1).map((row) => csvCell(row, col.roaster)));

  for (const row of rows.slice(1)) {
    const roaster = csvCell(row, col.roaster);
    const name = csvCell(row, col.name);
    if (!roaster || !name) {
      skipped += 1;
      continue;
    }
    const roasterId = roasterIds.get(roaster.trim().toLowerCase()) ?? null;

    const rawId = csvNum(csvCell(row, col.id));
    const existingId =
      rawId !== null && Number.isInteger(rawId) && rawId >= 1 && rawId <= 1_000_000_000 ? rawId : null;
    const existing = existingId !== null ? await db.select().from(coffees).where(eq(coffees.id, existingId)) : [];

    const decafValue = csvCell(row, col.decaf);
    const decaffeinated = ["yes", "true", "1", "x"].includes(decafValue.toLowerCase());

    let photoFile: string | null = null;
    if (col.photo >= 0) {
      const candidate = csvCell(row, col.photo);
      if (isValidPhotoName(candidate) && existsSync(path.join(UPLOAD_DIR, candidate))) {
        photoFile = candidate;
      } else if (candidate) {
        photosMissing += 1;
      }
    }

    const legacy = splitOrigin(csvCell(row, col.origin ?? -1));
    const country =
      col.country >= 0
        ? csvCell(row, col.country) || null
        : legacy.country;
    const region =
      col.region >= 0
        ? csvCell(row, col.region) || null
        : legacy.region;

    const values = {
      roaster,
      roasterId,
      name,
      country,
      region,
      mix: csvCell(row, col.mix) || null,
      origin: joinOrigin(country, region),
      variety: csvCell(row, col.variety) || null,
      producer: csvCell(row, col.producer) || null,
      elevation: csvCell(row, col.elevation) || null,
      process: csvCell(row, col.process) || null,
      roastLevel: csvCell(row, col.roastLevel) || null,
      roastDate: csvCell(row, col.roastDate) || null,
      purchaseDate: csvCell(row, col.purchaseDate) || null,
      tastingNotes: csvCell(row, col.tastingNotes) || null,
      notes: csvCell(row, col.notes) || null,
      rating: csvNum(csvCell(row, col.rating)),
      decaffeinated,
      aiEnriched: col.aiEnriched >= 0 ? ["yes", "true", "1", "x"].includes(csvCell(row, col.aiEnriched).toLowerCase()) : false,
    };
    const price = csvNum(csvCell(row, col.price));
    const weight = csvNum(csvCell(row, col.weight));

    if (existingId !== null && existing.length > 0) {
      await db
        .update(coffees)
        .set({
          ...values,
          priceCents: price !== null ? Math.round(price * 100) : null,
          weightGrams: weight !== null && weight > 0 ? Math.round(weight) : null,
          photoFile: photoFile ?? existing[0].photoFile,
          ...(col.aiEnriched >= 0 ? { aiEnriched: values.aiEnriched } : {}),
          updatedAt: new Date(),
        })
        .where(eq(coffees.id, existingId));
      updated += 1;
    } else {
      await db.insert(coffees).values({
        ...values,
        priceCents: price !== null ? Math.round(price * 100) : null,
        weightGrams: weight !== null && weight > 0 ? Math.round(weight) : null,
        photoFile,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      created += 1;
    }
  }

  revalidatePath("/");
  revalidatePath("/coffees");
  return {
    message: "CSV imported.",
    imported: created,
    total: created + updated,
    photosSkipped: photosMissing,
    skipped,
  };
}

/* ---------- AI enrichment (OpenRouter) ---------- */


function roasterFromHost(host: string): string {
  const label = (host.split(".")[0] || host).replace(/[-_]/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Feed-less store: build a minimal product from the page's own metadata. */
async function aiPageProduct(url: string): Promise<StoreProductDetail | null> {
  const meta = await fetchPageMeta(url);
  if (!meta.title && !meta.image) return null;
  const host = new URL(url).hostname.replace(/^www\./, "");
  return {
    roaster: roasterFromHost(host),
    name: meta.title ?? "Coffee",
    imageUrl: meta.image,
    variants: [{ id: "default", label: "Default", priceCents: null, weightGrams: null }],
  };
}

export type AiEnrichResult =
  | { ok: true; fields: AiCoffeeFields; roaster: AiRoasterFields }
  | { ok: false; message: string };

const SETTINGS_KEY = "openrouter_api_key";
const SETTINGS_MODEL_KEY = "openrouter_model";

/** Stored in-app key first, environment variable as fallback. */
export async function resolveAiKey(): Promise<string> {
  const row = await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY));
  return row[0]?.value || process.env.OPENROUTER_API_KEY || "";
}

/** Stored model first, then OPENROUTER_MODEL, then the built-in default. */
export async function resolveAiModel(): Promise<string> {
  const row = await db.select().from(settings).where(eq(settings.key, SETTINGS_MODEL_KEY));
  return row[0]?.value || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

/** Fetch the product page server-side and ask the AI to fill coffee facts. */
export async function aiEnrichProduct(url: string): Promise<AiEnrichResult> {
  return enrichCoffeePage(url, await resolveAiKey(), await resolveAiModel());
}

/* ---------- AI photo scan ---------- */

export type PhotoScanResult =
  | { ok: true; fields: PhotoFields; productUrl: string | null }
  | { ok: false; message: string };

/**
 * Read a coffee bag photo (as a data URL) with AI and extract label facts. If
 * the guessed roaster has a known store feed and a product title match is
 * found there, the matched product's page is also read and its (usually
 * fuller) facts take priority over the photo's — see mergePhotoAndPageFields.
 * Nothing is saved here: the caller reviews and picks which fields to apply.
 */
export async function scanCoffeePhoto(photoDataUrl: string): Promise<PhotoScanResult> {
  const apiKey = await resolveAiKey();
  if (!apiKey) return { ok: false, message: "OpenRouter API key is not configured." };
  const model = await resolveAiModel();

  const photo = await analyzeCoffeePhoto(photoDataUrl, apiKey, model);
  if (!photo.ok) return photo;

  let fields = photo.fields;
  let productUrl: string | null = null;

  if (fields.roaster && fields.name) {
    const store = storeFor(fields.roaster);
    if (store) {
      const products = await storeProducts(store);
      const match = bestMatch(fields.name, products);
      if (match?.productUrl) {
        const page = await enrichCoffeePage(match.productUrl, apiKey, model);
        if (page.ok) {
          productUrl = match.productUrl;
          fields = mergePhotoAndPageFields(fields, page.fields);
        }
      }
    }
  }

  return { ok: true, fields, productUrl };
}

export type SettingsState = { message?: string; ok?: boolean };

/** Save or remove the OpenRouter model selection. */
export async function saveAiModel(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  if (formData.get("resetModel") === "on") {
    await db.delete(settings).where(eq(settings.key, SETTINGS_MODEL_KEY));
    return { message: "Model reset to the default.", ok: true };
  }
  const value = text(formData, "openrouterModel");
  if (!value) {
    await db.delete(settings).where(eq(settings.key, SETTINGS_MODEL_KEY));
    return { message: "Model reset to the default.", ok: true };
  }
  await db
    .insert(settings)
    .values({ key: SETTINGS_MODEL_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
  return { message: "Model saved.", ok: true };
}


/** Save or remove the OpenRouter API key in the app's settings table. */
export async function saveApiKey(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  if (formData.get("remove") === "on") {
    await db.delete(settings).where(eq(settings.key, SETTINGS_KEY));
    return { message: "API key removed.", ok: true };
  }
  const value = text(formData, "openrouterApiKey");
  if (!value) return { message: "Enter a key, or use Remove." };
  if (value.length < 10) return { message: "That key looks too short." };
  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
  return { message: "API key saved.", ok: true };
}

/* ---------- update existing coffee from a product link ---------- */

export type LinkUpdateState = { message?: string; applied?: string[]; ok?: boolean };

/**
 * Re-read a coffee's product page and merge AI-extracted details into an
 * existing coffee. Only fills fields the page actually provides: values the
 * model returns as null/absent leave the coffee untouched, decaf is only set
 * when the page confirms it, and an existing photo is never replaced.
 */
export async function updateCoffeeFromLink(_prev: LinkUpdateState, formData: FormData): Promise<LinkUpdateState> {
  const id = intField(formData, "id", 1, 1_000_000_000);
  const url = text(formData, "url");
  if (id === null) return { message: "Missing coffee id." };
  if (!url) return { message: "Paste a product link first." };

  const [coffee] = await db.select().from(coffees).where(eq(coffees.id, id));
  if (!coffee) return { message: "Coffee not found." };

  const enriched = await aiEnrichProduct(url);
  if (!enriched.ok) return { ok: false, message: enriched.message };
  const f = enriched.fields;

  const applied: string[] = [];
  const changes: Partial<typeof coffees.$inferInsert> = { updatedAt: new Date() };

  if (f.country && f.country !== coffee.country) {
    changes.country = f.country;
    applied.push("Country");
  }
  if (f.region && f.region !== coffee.region) {
    changes.region = f.region;
    applied.push("Region");
  }
  if (f.variety && f.variety !== coffee.variety) {
    changes.variety = f.variety;
    applied.push("Variety");
  }
  if (f.producer && f.producer !== coffee.producer) {
    changes.producer = f.producer;
    applied.push("Producer");
  }
  if (f.elevation && f.elevation !== coffee.elevation) {
    changes.elevation = f.elevation;
    applied.push("Elevation");
  }
  if (f.process && f.process !== coffee.process) {
    changes.process = f.process;
    applied.push("Process");
  }
  if (f.roastLevel && f.roastLevel !== coffee.roastLevel) {
    changes.roastLevel = f.roastLevel;
    applied.push("Roast");
  }
  if (f.mix && f.mix !== coffee.mix) {
    changes.mix = f.mix;
    applied.push("Type");
  }
  if (f.decaffeinated && !coffee.decaffeinated) {
    changes.decaffeinated = true;
    applied.push("Decaf");
  }
  if (f.tastingNotes && f.tastingNotes !== coffee.tastingNotes) {
    changes.tastingNotes = f.tastingNotes;
    applied.push("Tasting notes");
  }

  if (changes.country !== undefined || changes.region !== undefined) {
    changes.origin = joinOrigin(changes.country ?? coffee.country, changes.region ?? coffee.region);
  }

  if (!coffee.photoFile) {
    const meta = await fetchPageMeta(url);
    if (meta.image) {
      const image = await downloadRemoteImage(meta.image);
      if (image) {
        try {
          changes.photoFile = await savePhotoBytes(image.data, image.ext);
          applied.push("Photo");
        } catch {
          /* keep existing (none) */
        }
      }
    }
  }

  changes.aiEnriched = true;

  if (applied.length > 0) {
    await db.update(coffees).set(changes).where(eq(coffees.id, id));
    revalidatePath("/");
    revalidatePath("/coffees");
    revalidatePath(`/coffees/${id}`);
    revalidatePath(`/coffees/${id}/edit`);
  }

  return {
    ok: true,
    message:
      applied.length > 0
        ? `Updated ${applied.length} field${applied.length === 1 ? "" : "s"}.`
        : "The page had no new details for this coffee.",
    applied,
  };
}

/* ---------- API keys ---------- */


export type ApiKeyState = { message?: string; ok?: boolean; key?: string };

/** Mint a new API key; the plaintext secret is returned exactly once. */
export async function generateApiKey(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const name = text(formData, "name") ?? "API key";
  const { secret } = await storeApiKey(name.slice(0, 80));
  revalidatePath("/settings");
  return { ok: true, message: "Key generated — copy it now, it will not be shown again.", key: secret };
}

export async function revokeApiKey(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const id = text(formData, "id");
  if (!id) return { message: "Missing key id." };
  await dropApiKey(id);
  revalidatePath("/settings");
  return { ok: true, message: "API key revoked." };
}

/* ---------- roasters ---------- */

export type RoasterFormState = { message?: string };

function collectRoaster(form: FormData) {
  return {
    name: requiredText(form, "roasterName"),
    website: text(form, "roasterWebsite"),
    state: text(form, "roasterState"),
    country: text(form, "roasterCountry"),
    specialty: text(form, "roasterSpecialty"),
    foundedYear: intField(form, "roasterFoundedYear", 1600, 2100),
    description: text(form, "roasterDescription"),
  };
}

export async function updateRoaster(id: number, _prev: RoasterFormState, formData: FormData): Promise<RoasterFormState> {
  const [existing] = await db.select().from(roasters).where(eq(roasters.id, id));
  if (!existing) return { message: "Roaster not found." };

  const input = collectRoaster(formData);
  if (!input.name) return { message: "Name is required." };

  let logo = existing.logoFile;
  const removeLogo = formData.get("removePhoto") === "on";
  const file = readPhoto(formData);
  if (removeLogo && !file) {
    await deletePhoto(existing.logoFile);
    logo = null;
  } else if (file) {
    await deletePhoto(existing.logoFile);
    logo = await savePhoto(file);
  }

  await db
    .update(roasters)
    .set({
      name: input.name,
      website: input.website,
      state: input.state,
      country: input.country,
      specialty: input.specialty,
      foundedYear: input.foundedYear,
      description: input.description,
      logoFile: logo,
      updatedAt: new Date(),
    })
    .where(eq(roasters.id, id));

  if (input.name.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
    await renameRoasterCoffees(id, existing.name, input.name);
  }

  revalidatePath("/"); revalidatePath("/coffees"); revalidatePath("/roasters");
  revalidatePath(`/roasters/${id}`);
  revalidatePath(`/roasters/${id}/edit`);
  redirect(`/roasters/${id}`);
}

/** No-op (rather than an error) if bags still reference this roaster — the UI disables the button in that case. */
export async function deleteRoaster(id: number): Promise<void> {
  const [existing] = await db.select().from(roasters).where(eq(roasters.id, id));
  if (!existing) return;
  const count = await countRoasterCoffees(id, existing.name);
  if (count > 0) return;
  await db.delete(roasters).where(eq(roasters.id, id));
  await deletePhoto(existing.logoFile);
  revalidatePath("/roasters");
  redirect("/roasters");
}

/* ---------- update existing roaster from a link ---------- */

export type RoasterLinkUpdateState = { message?: string; applied?: string[]; ok?: boolean };

/**
 * Re-read a roaster's own page (homepage/about, not a product page) and merge
 * AI-extracted profile facts into an existing roaster. Only fills fields the
 * page actually provides, and never replaces an existing logo.
 */
export async function updateRoasterFromLink(_prev: RoasterLinkUpdateState, formData: FormData): Promise<RoasterLinkUpdateState> {
  const id = intField(formData, "id", 1, 1_000_000_000);
  const url = text(formData, "url");
  if (id === null) return { message: "Missing roaster id." };
  if (!url) return { message: "Paste a link first." };

  const [roaster] = await db.select().from(roasters).where(eq(roasters.id, id));
  if (!roaster) return { message: "Roaster not found." };

  const enriched = await enrichRoasterPage(url, await resolveAiKey(), await resolveAiModel());
  if (!enriched.ok) return { ok: false, message: enriched.message };
  const f = enriched.fields;

  const applied: string[] = [];
  const changes: Partial<typeof roasters.$inferInsert> = { updatedAt: new Date() };

  if (f.state && f.state !== roaster.state) {
    changes.state = f.state;
    applied.push("State");
  }
  if (f.country && f.country !== roaster.country) {
    changes.country = f.country;
    applied.push("Country");
  }
  if (f.description && f.description !== roaster.description) {
    changes.description = f.description;
    applied.push("Description");
  }
  if (f.foundedYear && f.foundedYear !== roaster.foundedYear) {
    changes.foundedYear = f.foundedYear;
    applied.push("Founded");
  }
  if (f.specialty && f.specialty !== roaster.specialty) {
    changes.specialty = f.specialty;
    applied.push("Specialty");
  }

  if (!roaster.website) {
    try {
      changes.website = new URL(url).origin;
      applied.push("Website");
    } catch {
      /* not a valid absolute URL, skip */
    }
  }

  if (!roaster.logoFile && f.logoCandidates.length > 0) {
    const image = await downloadFirstWorkingImage(f.logoCandidates);
    if (image) {
      try {
        changes.logoFile = await savePhotoBytes(image.data, image.ext);
        applied.push("Logo");
      } catch {
        /* keep existing (none) */
      }
    }
  }

  changes.aiEnriched = true;
  changes.sourceUrl = url;

  if (applied.length > 0) {
    await db.update(roasters).set(changes).where(eq(roasters.id, id));
    revalidatePath("/roasters");
    revalidatePath(`/roasters/${id}`);
    revalidatePath(`/roasters/${id}/edit`);
  }

  return {
    ok: true,
    message:
      applied.length > 0
        ? `Updated ${applied.length} field${applied.length === 1 ? "" : "s"}.`
        : "The page had no new details for this roaster.",
    applied,
  };
}
