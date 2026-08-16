import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import { authenticate } from "@/lib/api-auth";
import { joinOrigin, mapCoffeeFields } from "@/lib/api-fields";
import { downloadRemoteImage, deletePhoto, savePhotoBytes } from "@/lib/photos";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function attachPhotoFromUrl(currentPhotoFile: string | null, url: unknown): Promise<{ photoFile: string | null; error?: string }> {
  if (typeof url !== "string" || !url) return { photoFile: currentPhotoFile };
  const image = await downloadRemoteImage(url);
  if (!image) return { photoFile: currentPhotoFile, error: "photoUrl could not be downloaded." };
  try {
    const photoFile = await savePhotoBytes(image.data, image.ext);
    if (currentPhotoFile && currentPhotoFile !== photoFile) await deletePhoto(currentPhotoFile);
    return { photoFile };
  } catch {
    return { photoFile: currentPhotoFile, error: "photoUrl could not be saved." };
  }
}

/** GET /api/v1/coffees — list every coffee. */
export async function GET(request: Request) {
  if (!(await authenticate(request))) return json({ error: "Unauthorized" }, 401);
  const rows = await db.select().from(coffees).orderBy(desc(coffees.createdAt));
  return json(rows);
}

/** POST /api/v1/coffees — create a coffee. */
export async function POST(request: Request) {
  if (!(await authenticate(request))) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const { values, errors } = mapCoffeeFields(body, { partial: false });
  if (errors.length > 0) return json({ error: "Validation failed.", errors }, 422);

  const { photoFile, error: photoError } = await attachPhotoFromUrl(null, body.photoUrl);
  if (photoError) return json({ error: photoError }, 422);

  const now = new Date();
  const [row] = await db
    .insert(coffees)
    .values({
      roaster: values.roaster!,
      name: values.name!,
      ...values,
      origin: joinOrigin(values.country ?? null, values.region ?? null),
      photoFile,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return json(row, 201);
}