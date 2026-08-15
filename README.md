# Bean Vault

A personal web app for tracking the coffee you buy. Every bag gets its roaster,
origin, variety, process, roast level, roast and purchase dates, price, weight,
rating, notes — and a photo snapshot. Built to run on your own machine or a
homelab server; all data stays on your disk.

## Features

- **Bag collection** — add a coffee with all relevant fields plus a photo
  upload (live preview, 10 MB cap, JPG/PNG/WebP/AVIF/GIF).
- **Card grid home page** — every bag as a tile with its photo, tags, price,
  weight and rating; click through to the detail page.
- **Spreadsheet grid editing** (`/grid`) — edit any number of coffees in a
  table. Cells **auto-save when you leave them**, with live forced formatting
  and validation:
  - price accepts only digits and a single `.`, and `25` becomes `25.00`;
  - weight accepts digits only;
  - roaster/name cannot be emptied;
  - unsaved edits trigger a leave-page warning.
  - Sort by clicking column headers; filter by search text, roaster, roast
    level, rating, and **year** (roast year, purchase year as fallback).
- **Photo auto-find** — bags without a snapshot can pull the real product
  image from the roaster's own store page (Shopify or WooCommerce product
  feeds, fuzzy-matched by name, tolerant of typos like "Guatamala" →
  "Guatemala"). One at a time, or a batch run for every missing photo.
- **Beanconqueror import** — bring in your existing history from a
  Beanconqueror JSON export. Re-importing the same file is safe: beans are
  matched by their source UUID and imports that already exist are skipped.
- **Single-user by design** — no accounts, no cloud, no telemetry.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, Server Actions) + React 19 + TypeScript
- [Drizzle ORM](https://orm.drizzle.team) with [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- Plain CSS (no framework), ESLint via `eslint-config-next`

## Quick start

Requirements: Node.js 20.9+ (22 LTS recommended).

```bash
npm install
npm run dev        # http://localhost:3000
```

The SQLite database is created and schema migrations are applied automatically
on first start — there is nothing else to set up.

Production:

```bash
npm run build
npm start
```

## Docker (homelab)

Published image: `ghcr.io/nmacy/coffee-tracker:latest` (linux/amd64, ~90 MB).
(The GitHub repo and container image keep the original technical
`coffee-tracker` name; the product name is Bean Vault.)

Run on a Debian x64 box with Docker:

```sh
docker run -d --name coffee-tracker -p 3000:3000 \
  -v coffee-tracker-data:/app/data \
  --restart unless-stopped \
  ghcr.io/nmacy/coffee-tracker:latest
```

Or just `docker compose up -d` (see `docker-compose.yml`).

Rebuild and publish from any host:

```bash
docker buildx build --platform linux/amd64 -t ghcr.io/nmacy/coffee-tracker:latest .
docker push ghcr.io/nmacy/coffee-tracker:latest
```

Notes:

- The image runs as a non-root `node` user and listens on `:3000`.
- **All persistence is the `/app/data` volume** — SQLite DB (auto-migrated on
  first start) plus uploaded photos. Back up the volume, not the container.
- ghcr packages default to **private**. For a passwordless `docker pull` on the
  lab, set the package public (GitHub → your profile → Packages → Coffee
  Tracker → Package settings → Danger Zone → Change visibility). Otherwise
  authenticate on the lab instead: `echo $PAT | docker login ghcr.io -u
  <user> --password-stdin` with a PAT that has `read:packages`.

## Importing from Beanconqueror

1. In the Beanconqueror app: **Settings → Data & Storage → Export to JSON**.
2. In Bean Vault: **Import** (header) → choose the file → Import beans.
3. The result screen shows how many beans were imported, how many were skipped
   as already present, and whether the export contained any photos.

What maps over (max 50 MB file):

| Beanconqueror field | Becomes |
|---|---|
| `name`, `roaster` | name, roaster |
| `cost` (currency from the export, USD) | price, stored as cents |
| `weight` | weight in grams |
| `rating` (0 → unrated) | rating |
| `roastingDate`, `buyDate` | roast date, purchase date |
| `roast` enum / `roast_custom` / **`roast_range` slider** | roast level |
| `bean_information` (country, region, variety, processing) | origin, variety, process |
| `decaffeinated` | `decaffeinated` appended to process |
| `note`, cupping notes, blend percentages | notes |

Notes and limitations:

- Idempotent: beans carry their Beanconqueror UUID in `source_uuid`, and
  re-importing a file never duplicates or overwrites rows you edited.
- Beanconqueror exports photos only as file-name references — the image data is
  not in the export, so snapshots cannot be recovered from it. Run the photo
  auto-find afterward instead.
- Roast level: the app's `roast` enum is often `UNKNOWN` in exports; the
  tracker also reads the `roast_range` slider (0–5), where 0 = not set.

## Photo auto-find coverage

Lookup runs against the roaster's storefront feed — the same image the store
page shows for that bag:

- **Shopify** stores via `/products.json` (paginated; full catalog): Happy Mug,
  Perc, Sey, Counter Culture, Daily Rise, Black & White.
- **WooCommerce** stores via the `wp-json/wc/store/products` REST feed:
  Wasatch Roasting Company.

Roasters with neither API or parked domains (S&W Craft Roasting, Hypergoat,
Lone Light, Cervantes) are reported as "no store feed found". Bags that have
rotated out of a store's current catalog genuinely have no product page left,
so nothing is guessed — upload a photo manually for those.

The roaster → store mapping lives in `src/lib/storefinder.ts`; extend it there
if a roaster enables a feed.

## Data & backups

- Database: `data/coffee.db` (SQLite, WAL mode)
- Uploaded photos: `data/uploads/` (served through `/api/photos/[name]`)
- The whole `data/` directory is **gitignored** — it is your only copy.
  Back it up (the file is a single SQLite DB plus an images folder).

Schema lives in `src/db/schema.ts`; migration SQL lives in `drizzle/` and is
applied automatically on startup. After changing the schema, regenerate with
`npx drizzle-kit generate`.

## Project layout

```
src/
  app/
    page.tsx                 # card grid home
    new/                     # add a coffee (photo upload form)
    grid/                    # spreadsheet editing: autosave, sort, filters
    import/                  # Beanconqueror JSON import
    coffees/[id]/            # detail view (+ edit page)
    api/photos/[name]/       # serves uploaded photos
    actions.ts               # server actions (create/update/delete/import/find)
  components/                # grid editor, forms, buttons
  db/                        # schema + SQLite client (auto-migrates)
  lib/                       # parsers, validation, photo + storefront lookup
docker-compose.yml           # homelab compose config
Dockerfile                   # multi-stage, standalone output (~90 MB)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | dev server on :3000 |
| `npm run build` | production build (standalone output) |
| `npm start` | serve the production build |
| `npm run lint` | ESLint |
| `npx drizzle-kit generate` | write a migration from `src/db/schema.ts` |

## Known trade-offs

- Photos render with plain `<img>` rather than `next/image` — deliberate, since
  photos are local files served by the app itself and the image optimizer would
  add moving parts for zero real gain here. List thumbnails lazy-load.
- Prices are stored as cents and displayed in USD (matching the Beanconqueror
  export currency).