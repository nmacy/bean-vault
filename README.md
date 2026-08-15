# Coffee Tracker

Track the coffee you buy: roaster, origin, variety, process, roast level, roast
and purchase dates, price, weight, rating, notes — plus a photo snapshot of each
bag. Edit many bags at once in the spreadsheet-style **Grid** view (changes are
highlighted until you save). Import your existing history from a Beanconqueror
JSON export (Settings → Data & Storage → Export to JSON) via the **Import**
page; re-importing is safe and skips already-imported beans.

## Stack

- Next.js 16 (App Router, server actions) + React 19 + TypeScript
- SQLite via Drizzle ORM (better-sqlite3)
- Photos stored on disk under `data/uploads/`, served from `/api/photos/[name]`

## Run

```bash
npm install
npm run dev       # http://localhost:3000
```

The SQLite database is created and migrations applied automatically on first
run. Production:

```bash
npm run build
npm start
```

## Data

- Database: `data/coffee.db` (WAL mode)
- Uploaded photos: `data/uploads/`
- Schema lives in `src/db/schema.ts`; migrations in `drizzle/` (regenerate
  with `npx drizzle-kit generate`, applied automatically on startup)

Back up the whole `data/` directory. Local data is gitignored.