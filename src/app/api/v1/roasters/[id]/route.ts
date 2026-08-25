import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roasters } from "@/db/schema";
import { authenticate } from "@/lib/api-auth";
import { mapRoasterFields } from "@/lib/api-fields";
import { deletePhoto, downloadRemoteImage, savePhotoBytes } from "@/lib/photos";
import { countRoasterCoffees, findRoasterByName, renameRoasterCoffees } from "@/lib/roasters";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function load(id: number) {
  const [row] = await db.select().from(roasters).where(eq(roasters.id, id));
  return row ?? null;
}

/** GET /api/v1/roasters/:id */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(request))) return json({ error: "Unauthorized" }, 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return json({ error: "Bad id." }, 400);
  const row = await load(id);
  if (!row) return json({ error: "Not found." }, 404);
  return json(row);
}

/** PATCH /api/v1/roasters/:id — merge any provided fields; renaming cascades to coffees.roaster. */
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

  const { values, errors } = mapRoasterFields(body, { partial: true });
  if (errors.length > 0) return json({ error: "Validation failed.", errors }, 422);

  if (values.name && values.name.toLowerCase() !== existing.name.toLowerCase()) {
    const clash = await findRoasterByName(values.name);
    if (clash && clash.id !== id) {
      return json({ error: `A roaster named "${values.name}" already exists.` }, 409);
    }
  }

  // logoUrl replaces the logo (or sets one when missing).
  let logoFile = existing.logoFile;
  if (Object.prototype.hasOwnProperty.call(body, "logoUrl")) {
    const url = body.logoUrl;
    if (url === null || url === "") {
      if (existing.logoFile) {
        await deletePhoto(existing.logoFile);
        logoFile = null;
      }
    } else if (typeof url === "string") {
      const image = await downloadRemoteImage(url);
      if (!image) return json({ error: "logoUrl could not be downloaded." }, 422);
      try {
        const saved = await savePhotoBytes(image.data, image.ext);
        if (existing.logoFile && existing.logoFile !== saved) await deletePhoto(existing.logoFile);
        logoFile = saved;
      } catch {
        return json({ error: "logoUrl could not be saved." }, 422);
      }
    } else {
      return json({ error: "logoUrl must be a string URL." }, 422);
    }
  }

  const [updated] = await db
    .update(roasters)
    .set({ ...values, logoFile, updatedAt: new Date() })
    .where(eq(roasters.id, id))
    .returning();

  if (values.name && values.name.toLowerCase() !== existing.name.toLowerCase()) {
    await renameRoasterCoffees(id, existing.name, values.name);
  }

  return json(updated);
}

/** DELETE /api/v1/roasters/:id — blocked while any coffee still references it. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(request))) return json({ error: "Unauthorized" }, 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return json({ error: "Bad id." }, 400);
  const existing = await load(id);
  if (!existing) return json({ error: "Not found." }, 404);

  const count = await countRoasterCoffees(id, existing.name);
  if (count > 0) {
    return json({ error: `Roaster has ${count} coffee(s); reassign or delete them first.` }, 409);
  }

  await db.delete(roasters).where(eq(roasters.id, id));
  await deletePhoto(existing.logoFile);
  return json({ ok: true });
}
