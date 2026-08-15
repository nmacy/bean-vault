import path from "node:path";
import { mkdirSync } from "node:fs";
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

export const db = drizzle(sqlite);

// Apply schema migrations on startup so `npm run dev` just works.
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });