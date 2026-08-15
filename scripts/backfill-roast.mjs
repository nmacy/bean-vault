import { parseBeanconqueror } from "../src/lib/beanconqueror.ts";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";

const text = readFileSync(new URL("../Beanconqueror.json", import.meta.url), "utf8");
const parsed = parseBeanconqueror(text);

const db = new Database("data/coffee.db");
const upd = db.prepare(
  "update coffees set roast_level = ?, updated_at = ? where source_uuid = ? and roast_level is null",
);
let n = 0;
for (const b of parsed.beans) {
  if (b.sourceUuid && b.roastLevel) {
    n += upd.run(b.roastLevel, Date.now(), b.sourceUuid).changes;
  }
}
console.log("backfilled rows:", n);
console.log("distribution after:", db.prepare("select roast_level, count(*) as c from coffees where roast_level is not null group by roast_level").all());