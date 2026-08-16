import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import { authenticate } from "@/lib/api-auth";
import { joinOrigin, mapCoffeeFields } from "@/lib/api-fields";
import { deletePhoto, downloadRemoteImage, savePhotoBytes } from "@/lib/photos";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function load(id: number) {
  const [row] = await db.select().from(coffees).where(eq(coffees.id, id));
  return row ?? null;
}

/** GET /api/v1/coffees/:id */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(request))) return json({ error: "Unauthorized" }, 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return json({ error: "Bad id." }, 400);
  const row = await load(id);
  if (!row) return json({ error: "Not found." }, 404);
  return json(row);
}

/** PATCH /api/v1/coffees/:id — merge any provided fields. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(request))) return json({ error: "Unauthorized" }, 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return json({ error: "Bad id." }, 400);
  const existing = await load(id);
  if (!existing) return json({ error: "Not found." }, 404);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const { values, errors } = mapCoffeeFields(body, { partial: true });
  if (errors.length > 0) return json({ error: "Validation failed.", errors }, 422);

  // photoUrl replaces the photo (or sets one when missing).
  let photoFile = existing.photoFile;
  if (Object.prototype.hasOwnProperty.call(body, "photoUrl")) {
    const url = body.photoUrl;
    if (url === null || url === "") {
      if (existing.photoFile) {
        await deletePhoto(existing.photoFile);
        photoFile = null;
      }
    } else if (typeof url === "string") {
      const image = await downloadRemoteImage(url);
      if (!image) return json({ error: "photoUrl could not be downloaded." }, 422);
      try {
        const saved = await savePhotoBytes(image.data, image.ext);
        if (existing.photoFile && existing.photoFile !== saved) await deletePhoto(existing.photoFile);
        photoFile = saved;
      } catch {
        return json({ error: "photoUrl could not be saved." }, 422);
      }
    } else {
      return json({ error: "photoUrl must be a string URL." }, 422);
    }
  }

  const changes = { ...values };
  if (Object.prototype.hasOwnProperty.call(body, "country") || Object.prototype.hasOwnProperty.call(body, "region")) {
    changes.origin = joinOrigin(
      changes.country !== undefined ? changes.country : existing.country,
      changes.region !== undefined ? changes.region : existing.region,
    );
  }

  const [updated] = await db
    .update(coffees)
    .set({ ...changes, photoFile, updatedAt: new Date() })
    .where(eq(coffees.id, id))
    .returning();
  return json(updated);
}

/** DELETE /api/v1/coffees/:id */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(request))) return json({ error: "Unauthorized" }, 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return json({ error: "Bad id." }, 400);
  const existing = await load(id);
  if (!existing) return json({ error: "Not found." }, 404);
  await db.delete(coffees).where(eq(coffees.id, id));
  await deletePhoto(existing.photoFile);
  return json({ ok: true });
}