import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Generated names are always 32 lowercase hex chars + a dot + ext.
const PHOTO_NAME_RE = /^[a-f0-9]{32}\.(jpg|jpeg|png|webp|avif|gif)$/;

export function isValidPhotoName(name: string): boolean {
  return PHOTO_NAME_RE.test(name);
}

function extOf(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXTS.has(ext) ? ext : null;
}

export async function savePhoto(file: File): Promise<string> {
  const ext = extOf(file.name);
  if (!ext) {
    throw new Error("Unsupported image type. Use JPG, PNG, WebP, AVIF or GIF.");
  }
  if (file.size === 0) {
    throw new Error("Photo is empty.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Photo is larger than 10 MB.");
  }
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function deletePhoto(name: string | null): Promise<void> {
  if (!name) return;
  if (!isValidPhotoName(name)) return;
  try {
    await unlink(path.join(UPLOAD_DIR, name));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}