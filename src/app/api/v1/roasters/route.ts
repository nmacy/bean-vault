import { db } from "@/db";
import { roasters } from "@/db/schema";
import { authenticate } from "@/lib/api-auth";
import { mapRoasterFields } from "@/lib/api-fields";
import { downloadRemoteImage, savePhotoBytes } from "@/lib/photos";
import { findRoasterByName } from "@/lib/roasters";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function attachLogoFromUrl(url: unknown): Promise<{ logoFile: string | null; error?: string }> {
  if (typeof url !== "string" || !url) return { logoFile: null };
  const image = await downloadRemoteImage(url);
  if (!image) return { logoFile: null, error: "logoUrl could not be downloaded." };
  try {
    return { logoFile: await savePhotoBytes(image.data, image.ext) };
  } catch {
    return { logoFile: null, error: "logoUrl could not be saved." };
  }
}

/** GET /api/v1/roasters — list every roaster. */
export async function GET(request: Request) {
  if (!(await authenticate(request))) return json({ error: "Unauthorized" }, 401);
  const rows = await db.select().from(roasters).orderBy(roasters.name);
  return json(rows);
}

/** POST /api/v1/roasters — create a roaster. Rejects a duplicate name (case-insensitive). */
export async function POST(request: Request) {
  if (!(await authenticate(request))) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const { values, errors } = mapRoasterFields(body, { partial: false });
  if (errors.length > 0) return json({ error: "Validation failed.", errors }, 422);

  if (await findRoasterByName(values.name!)) {
    return json({ error: `A roaster named "${values.name}" already exists.` }, 409);
  }

  const { logoFile, error: logoError } = await attachLogoFromUrl(body.logoUrl);
  if (logoError) return json({ error: logoError }, 422);

  const now = new Date();
  const [row] = await db
    .insert(roasters)
    .values({ name: values.name!, ...values, logoFile, createdAt: now, updatedAt: now })
    .returning();
  return json(row, 201);
}
