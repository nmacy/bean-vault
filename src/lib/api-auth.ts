/**
 * API key management: secrets are generated once, shown once, and stored only
 * as sha256 hashes, so database backups never expose a usable key.
 */

import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

const KEYS_ROW = "api_keys";

export type ApiKeyMeta = {
  id: string;
  name: string;
  hash: string;
  createdAt: string;
};

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export async function readApiKeys(): Promise<ApiKeyMeta[]> {
  const row = await db.select().from(settings).where(eq(settings.key, KEYS_ROW));
  if (!row[0]?.value) return [];
  try {
    const parsed: unknown = JSON.parse(row[0].value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (k): k is ApiKeyMeta =>
        typeof k === "object" &&
        k !== null &&
        typeof (k as Record<string, unknown>).id === "string" &&
        typeof (k as Record<string, unknown>).hash === "string",
    );
  } catch {
    return [];
  }
}

async function writeApiKeys(keys: ApiKeyMeta[]): Promise<void> {
  if (keys.length === 0) {
    await db.delete(settings).where(eq(settings.key, KEYS_ROW));
    return;
  }
  const value = JSON.stringify(keys);
  await db
    .insert(settings)
    .values({ key: KEYS_ROW, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function addApiKey(name: string): Promise<{ id: string; secret: string }> {
  const id = randomBytes(6).toString("hex");
  const secret = `bv_${randomBytes(24).toString("hex")}`;
  const keys = await readApiKeys();
  keys.push({ id, name, hash: hashSecret(secret), createdAt: new Date().toISOString() });
  await writeApiKeys(keys);
  return { id, secret };
}

export async function revokeApiKey(id: string): Promise<void> {
  const keys = await readApiKeys();
  await writeApiKeys(keys.filter((k) => k.id !== id));
}

/** Verify an Authorization header value against stored hashes. */
export async function authenticate(request: Request): Promise<ApiKeyMeta | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const hash = hashSecret(token);
  const keys = await readApiKeys();
  return keys.find((k) => k.hash === hash) ?? null;
}