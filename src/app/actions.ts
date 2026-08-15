"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import { deletePhoto, savePhoto } from "@/lib/photos";
import { dateField, dollarsToCents, intField, photoFile as readPhoto, requiredText, text } from "@/lib/validation";
import { parseBeanconqueror } from "@/lib/beanconqueror";

export type FormState = { message?: string };

export type ImportState = {
  message?: string;
  imported?: number;
  total?: number;
  photosSkipped?: number;
};

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