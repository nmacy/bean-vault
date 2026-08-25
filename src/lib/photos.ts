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

export async function savePhotoBytes(data: Uint8Array, ext: string): Promise<string> {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_EXTS.has(e)) throw new Error(`Unsupported image type: ${e}`);
  if (data.length === 0) throw new Error("Photo is empty.");
  if (data.length > MAX_PHOTO_BYTES) throw new Error("Photo is larger than 10 MB.");
  const name = `${randomBytes(16).toString("hex")}.${e}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), data);
  return name;
}

export async function savePhoto(file: File): Promise<string> {
  const ext = extOf(file.name);
  if (!ext) {
    throw new Error("Unsupported image type. Use JPG, PNG, WebP, AVIF or GIF.");
  }
  return savePhotoBytes(Buffer.from(await file.arrayBuffer()), ext);
}

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

/** Download an image URL, validate it, and return bytes + extension. */
export async function downloadRemoteImage(url: string): Promise<{ data: Uint8Array; ext: string } | null> {
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

/** Try each URL in order, returning the first that downloads successfully — a broken/404 link (theme cruft is common) just falls through to the next candidate. */
export async function downloadFirstWorkingImage(urls: string[]): Promise<{ data: Uint8Array; ext: string } | null> {
  for (const url of urls) {
    const image = await downloadRemoteImage(url);
    if (image) return image;
  }
  return null;
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