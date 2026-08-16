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

Published image: `ghcr.io/nmacy/bean-vault:latest` (linux/amd64, ~90 MB).
Source: <https://github.com/nmacy/bean-vault>.

Run on a Debian x64 box with Docker:

```sh
docker run -d --name bean-vault -p 3000:3000 \
  -v bean-vault-data:/app/data \
  --restart unless-stopped \
  ghcr.io/nmacy/bean-vault:latest
```

Or just `docker compose up -d` (see `docker-compose.yml`).

Rebuild and publish from any host:

```bash
docker buildx build --platform linux/amd64 -t ghcr.io/nmacy/bean-vault:latest .
docker push ghcr.io/nmacy/bean-vault:latest
```

Notes:

- The image runs as a non-root `node` user and listens on `:3000`.
- **All persistence is the `/app/data` volume** — SQLite DB (auto-migrated on
  first start) plus uploaded photos. Back up the volume, not the container.
- ghcr packages default to **private**. For a passwordless `docker pull` on
  the lab, set the package public (GitHub → your profile → Packages → Bean
  Vault → Package settings → Danger Zone → Change visibility). Otherwise
  authenticate on the lab instead: `echo $PAT | docker login ghcr.io -u
  <user> --password-stdin` with a PAT that has `read:packages`.
- **Config**: the OpenRouter key/model can be set in-app (Settings, stored in
  the data volume) or via environment variables. `docker-compose.yml` passes
  `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` / `TZ` through from `.env`
  (copy `.env.example`) and mounts the persistent `bean-vault-data` volume.

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
## AI enrichment (optional)

When adding a coffee **from a store link**, an "Ask AI to fill details"
button sends the product page to [OpenRouter](https://openrouter.ai) and
prefills editable fields — country, region, process, roast level,
blend/single-origin, decaf, tasting notes, and the product description as
notes. This is an assisted draft; nothing is saved until you review.

The key can be managed from the app itself: **Settings** (hamburger menu)
saves it in the local settings table — server-side only, never sent to the
browser and never included in exports. Alternatively set `OPENROUTER_API_KEY`
in `.env.local` (see `.env.example`) as a fallback. Optional
`OPENROUTER_MODEL` overrides the default `openai/gpt-4o-mini`.

## HTTP API

JSON API, secured with bearer keys. Generate and revoke keys in
**Settings → API access** — a secret is shown exactly once, then only its
sha256 hash is stored. The docs below assume `http://localhost:3000` and a
key in the environment:

```bash
export BEAN_VAULT_URL=http://localhost:3000
export BEAN_VAULT_KEY="bv_…"        # from Settings → API access
```

### Authentication

Send the key on every request:

```bash
curl -H "Authorization: Bearer $BEAN_VAULT_KEY" "$BEAN_VAULT_URL/api/v1/coffees"
```

Missing or invalid keys get `401 {"error":"Unauthorized"}`.

### Endpoints

| Endpoint | Method | Body | Meaning |
|---|---|---|---|
| `/api/v1/coffees` | GET | — | List all coffees (newest first) |
| `/api/v1/coffees` | POST | coffee fields | Create |
| `/api/v1/coffees/:id` | GET | — | Get one coffee |
| `/api/v1/coffees/:id` | PATCH | fields to change | Merge-update; `null` clears a field |
| `/api/v1/coffees/:id` | DELETE | — | Delete (also removes its photo file) |

### Examples

List coffees (pretty-print with `jq`):

```bash
curl -s -H "Authorization: Bearer $BEAN_VAULT_KEY" \
  "$BEAN_VAULT_URL/api/v1/coffees" | jq '.[] | {id, name, roaster, priceCents}'
```

Add a coffee with a photo pulled from a product page:

```bash
curl -s -X POST -H "Authorization: Bearer $BEAN_VAULT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "roaster": "S&W Craft Roasting",
        "name": "Colombia Villa Betulia Natural Gesha King",
        "country": "Colombia",
        "region": "Villa Betulia",
        "process": "natural",
        "priceCents": 2600,
        "weightGrams": 340,
        "photoUrl": "https://…/image.jpeg"
      }' \
  "$BEAN_VAULT_URL/api/v1/coffees" | jq '{id, origin, priceCents}'
```

Update one field (or clear it with `"region": null`):

```bash
curl -s -X PATCH -H "Authorization: Bearer $BEAN_VAULT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "tastingNotes": "Sweet citrus, creamy body"}' \
  "$BEAN_VAULT_URL/api/v1/coffees/12" | jq '{rating, tastingNotes}'
```

Delete:

```bash
curl -s -X DELETE -H "Authorization: Bearer $BEAN_VAULT_KEY" \
  "$BEAN_VAULT_URL/api/v1/coffees/12"   # -> {"ok":true}
```

From a script (Python, stdlib only):

```python
import json, urllib.request

KEY = "bv_…"; URL = "http://localhost:3000/api/v1/coffees"

req = urllib.request.Request(URL, headers={"Authorization": f"Bearer {KEY}"})
coffees = json.load(urllib.request.urlopen(req))
print(sum(c["priceCents"] or 0 for c in coffees) / 100, "spent in total")
```

### Field reference

**Writable** (POST body / PATCH merge). Unknown keys are ignored; `null` or empty
string clears a field on PATCH.

| Key | Type | Constraints / format |
|---|---|---|
| `roaster` | `string` | 1–120 chars. **Required on create**; cannot be emptied via PATCH. |
| `name` | `string` | 1–120 chars. **Required on create**; cannot be emptied via PATCH. |
| `country` | `string \| null` | ≤ 80 chars. |
| `region` | `string \| null` | ≤ 80 chars. |
| `mix` | `"single-origin" \| "blend" \| null` | Strict enum. |
| `variety` | `string \| null` | ≤ 120 chars. |
| `producer` | `string \| null` | ≤ 120 chars. |
| `elevation` | `string \| null` | Numbers only — digits, commas, dots, spaces and range dashes (`"1,900–2,100"`). No units/letters. ≤ 40 chars. |
| `process` | `string \| null` | ≤ 80 chars. |
| `roastLevel` | `"light" \| "medium-light" \| "medium" \| "medium-dark" \| "dark" \| null` | Strict enum. |
| `roastDate` | `string \| null` | `YYYY-MM-DD`. |
| `purchaseDate` | `string \| null` | `YYYY-MM-DD`. |
| `priceCents` | `integer \| null` | Whole cents, 0–100,000,000 (e.g. `2600` = $26.00). **No commas or units.** |
| `weightGrams` | `integer \| null` | 1–1,000,000. |
| `rating` | `integer \| null` | 1–5. |
| `notes` | `string \| null` | ≤ 4000 chars. |
| `tastingNotes` | `string \| null` | ≤ 4000 chars. |
| `decaffeinated` | `boolean` | Default `false`. |
| `photoUrl` | `string \| null` | Write-only. POST: server downloads and stores the image. PATCH: replaces the photo; `null` or `""` removes it. Never returned. |

**Read-only** (present in responses, not accepted in bodies):

| Key | Type | Notes |
|---|---|---|
| `id` | `integer` | URI id (`/api/v1/coffees/:id`). |
| `origin` | `string \| null` | Always derived from `country` + `region`; never accepted directly. |
| `aiEnriched` | `boolean` | Set when the AI assisted an entry. |
| `sourceUuid` | `string \| null` | Beanconqueror import id (dedupe). |
| `photoFile` | `string \| null` | Stored photo filename; manage photos via `photoUrl`. |
| `createdAt` / `updatedAt` | `string` (ISO 8601) | Server-managed timestamps. |

**Sample response** (`GET /api/v1/coffees/:id`):

```json
{
  "id": 121,
  "roaster": "S&W Craft Roasting",
  "name": "Colombia Villa Betulia Natural Gesha King",
  "origin": "Colombia, Villa Betulia",
  "country": "Colombia",
  "region": "Villa Betulia",
  "mix": "single-origin",
  "variety": "Gesha",
  "producer": "Wilfredo Daza",
  "elevation": "1,900–2,100",
  "process": "natural",
  "roastLevel": "medium",
  "roastDate": "2026-07-20",
  "purchaseDate": null,
  "priceCents": 2600,
  "weightGrams": 340,
  "rating": 5,
  "notes": null,
  "tastingNotes": "Sweet citrus, creamy body",
  "decaffeinated": false,
  "aiEnriched": true,
  "sourceUuid": null,
  "photoFile": "e1aae12834864876ad7c80ddc873f89f.jpg",
  "createdAt": "2026-08-15T09:00:00.000Z",
  "updatedAt": "2026-08-15T09:00:00.000Z"
}
```

### Errors

Non-2xx responses are JSON: `{"error": "…"}` — and validation failures add an
`errors` array listing each problem, e.g.
`422 {"error":"Validation failed.","errors":["priceCents must be an integer
number of cents (no commas)."]}`. Common codes: 401 unauthenticated, 404 not
found, 400 bad JSON, 422 validation.
