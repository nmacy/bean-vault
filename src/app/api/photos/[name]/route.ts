import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, isValidPhotoName } from "@/lib/photos";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!isValidPhotoName(name)) return new Response("Not found", { status: 404 });

  const filePath = path.join(UPLOAD_DIR, name);
  try {
    const contents = await readFile(filePath);
    const ext = name.split(".").pop() ?? "";
    return new Response(contents, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}