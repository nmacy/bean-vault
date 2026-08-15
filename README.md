# Coffee Tracker

Track the coffee you buy: roaster, origin, variety, process, roast level, roast
and purchase dates, price, weight, rating, notes — plus a photo snapshot of each
bag. Edit many bags at once in the spreadsheet-style **Grid** view (changes are
highlighted until you save). Coffees without a snapshot can fetch one
automatically from the roaster's own store page (Shopify/WooCommerce product
feeds, fuzzy-matched by name) — one at a time or in a batch from the grid.
Import your existing history from a Beanconqueror JSON export (Settings → Data
& Storage → Export to JSON) via the **Import** page; re-importing is safe and
skips already-imported beans.

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

## Docker (homelab)

Image: `ghcr.io/nmacy/coffee-tracker:latest` (linux/amd64; already pushed).

Build locally for the lab's `linux/amd64` (works from any host, e.g. an
M-series Mac) and push:

```bash
docker buildx build --platform linux/amd64 -t ghcr.io/nmacy/coffee-tracker:latest .
docker push ghcr.io/nmacy/coffee-tracker:latest   # after: echo $GH_CR_PAT | docker login ghcr.io -u nmacy --password-stdin
```

Run on the lab (Debian x64 + Docker):

```sh
docker run -d --name coffee-tracker -p 3000:3000 \
  -v coffee-tracker-data:/app/data \
  --restart unless-stopped \
  ghcr.io/nmacy/coffee-tracker:latest
```

or `docker compose up -d` using the included `docker-compose.yml`.

- ghcr packages default to **private**; for an unauthenticated `docker pull` on
  the lab, set the package visible: GitHub → your profile → Packages →
  Coffee Tracker → Package settings → Danger Zone → Change visibility → Public.
  Otherwise log the lab in first: `echo $PAT | docker login ghcr.io -u nmacy
  --password-stdin` (a PAT with `read:packages`).
- All persistence lives in the `/app/data` volume: SQLite DB (auto-migrated on
  first start) plus uploaded photos. Back up that volume, not the container.
- Runs as a non-root `node` user; listens on `:3000`.