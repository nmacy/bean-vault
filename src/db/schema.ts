import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const coffees = sqliteTable("coffees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roaster: text("roaster").notNull(),
  name: text("name").notNull(),
  origin: text("origin"), // legacy combined value, kept for back-compat
  country: text("country"),
  region: text("region"),
  mix: text("mix"), // "single-origin" | "blend"
  variety: text("variety"),
  process: text("process"),
  roastLevel: text("roast_level"),
  roastDate: text("roast_date"), // ISO YYYY-MM-DD
  purchaseDate: text("purchase_date"), // ISO YYYY-MM-DD
  priceCents: integer("price_cents"),
  weightGrams: integer("weight_grams"),
  rating: integer("rating"), // 1..5
  notes: text("notes"),
  tastingNotes: text("tasting_notes"),
  decaffeinated: integer("decaffeinated", { mode: "boolean" }).notNull().default(false),
  aiEnriched: integer("ai_enriched", { mode: "boolean" }).notNull().default(false),
  photoFile: text("photo_file"), // filename inside data/uploads
  sourceUuid: text("source_uuid").unique(), // Beanconqueror bean uuid for idempotent import
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type Coffee = typeof coffees.$inferSelect;
export type NewCoffee = typeof coffees.$inferInsert;

/** Tiny key/value store for app settings (e.g. the OpenRouter API key). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});