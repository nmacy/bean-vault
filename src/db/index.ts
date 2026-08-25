import path from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import "server-only";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "coffee.db");

export const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite);

/**
 * Apply schema migrations on startup so `npm run dev` just works.
 *
 * Page-data collection and multiple server workers can import this module at
 * the same time; migrate() is not safe to run concurrently (duplicate
 * CREATE TABLE races). We serialize it with a lock directory, and every other
 * process sees already-applied migrations the moment the lock is free.
 */
const LOCK_DIR = path.join(dataDir, ".migrate.lock");
const LOCK_TIMEOUT_MS = 15_000;

function runMigrationsOnce() {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      mkdirSync(LOCK_DIR);
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
      if (Date.now() > deadline) {
        throw new Error("Timed out waiting for another process to finish migrations.");
      }
      // Sleep 100 ms without timers (module init is synchronous).
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  try {
    migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    backfillRoasterIds();
  } finally {
    rmSync(LOCK_DIR, { recursive: true, force: true });
  }
}

/**
 * Populate roasters/coffees.roaster_id for bags that predate the roasters
 * table (or were written by a path that hadn't been wired up yet). Idempotent
 * and cheap when there is nothing to do; raw sync SQL to match the rest of
 * this module's synchronous, no-top-level-await startup style.
 */
function backfillRoasterIds() {
  const missing = sqlite
    .prepare(`select distinct roaster from coffees where roaster_id is null`)
    .all() as { roaster: string }[];
  if (missing.length === 0) return;

  const insertRoaster = sqlite.prepare(
    `insert into roasters (name, created_at, updated_at) values (?, ?, ?) on conflict(name) do nothing`,
  );
  const findRoasterId = sqlite.prepare(`select id from roasters where lower(name) = lower(?)`);
  const linkCoffees = sqlite.prepare(
    `update coffees set roaster_id = ? where roaster_id is null and lower(roaster) = lower(?)`,
  );

  const run = sqlite.transaction((names: string[]) => {
    const now = Math.floor(Date.now() / 1000);
    for (const raw of names) {
      const name = raw.trim();
      if (!name) continue;
      insertRoaster.run(name, now, now);
      const row = findRoasterId.get(name) as { id: number } | undefined;
      if (row) linkCoffees.run(row.id, name);
    }
  });
  run(missing.map((r) => r.roaster));
}

runMigrationsOnce();