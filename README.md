# Bean Vault

A personal web app for tracking the coffee you buy. Every bag gets its roaster,
origin, variety, process, roast level, roast and purchase dates, price, weight,
rating, notes, a photo snapshot — and a lifecycle (resting → frozen → opened →
empty) that tracks resting days, open days and time in the freezer. Built to
run on your own machine or a homelab server; all data stays on your disk.

## Features

- **Dashboard home** — stats over your whole collection with a time-range
  selector (last 3/6/12 months, this year, all time, or custom). Bags, total
  spend, average/median price, total weight, average rating, decaf share, a
  roast-date timeline, and breakdowns by roaster, country, roast level,
  process, rating and blend/single-origin — every segment drills down to the
  bags behind it.
- **Bag collection** (`/coffees`) — a tiles view of every bag with its photo,
  tags, price, weight and rating. Click through to the detail page.
- **Filtering and sorting** (`/coffees`, tiles and grid alike) — a shared
  toolbar above both views: search text, roaster, roast level, rating, year
  (roast year, purchase year as fallback) and decaf filters, plus a sort-by
  field with a direction toggle. Switching between tiles and grid keeps the
  same filters and sort applied — it's shared state, not per-view. The grid's
  column headers are an alternate way to set the same sort. A separate
  status filter (available/opened/resting/frozen/empty/all, where "available"
  means any non-empty bag) sits above it. All of it persists between visits.
- **Spreadsheet grid editing** (`/coffees`, grid view) — toggle between tiles
  and a table to edit any number of coffees. Cells **auto-save when you leave
  them**, with live forced formatting and validation:
  - price accepts only digits and a single `.`, and `25` becomes `25.00`;
  - weight accepts digits only;
  - roaster/name cannot be emptied;
  - unsaved edits trigger a leave-page warning;
  - show/hide columns (persisted separately, grid-only).
  - Lifecycle fields are editable too — opened/frozen/unfrozen/emptied dates,
    same raw fields the edit form exposes. Status is a read-only column
    derived from those dates (as on the edit form), not independently
    settable — edit the surrounding dates to move a bag through its
    lifecycle from the grid; one-click Freeze/Open/Empty buttons
    remain on the detail page.
- **Bag lifecycle** — each bag is `resting` by default and moves through a
  small state machine: `resting ⇄ frozen`, `resting → opened`, `frozen →
  empty`, `opened → frozen`, and `opened → empty`; emptying is undoable back
  to `resting`. The app tracks **resting days** (since roast, minus time
  frozen) and **open days**. Frozen time comes straight from `frozenAt`/
  `unfrozenAt` — a bag is assumed to be frozen at most once, so there's no
  separate stored tally to keep in sync. Re-freezing after an unfreeze is
  still possible from the UI, but only the most recent freeze span counts
  toward resting time; an earlier one is overwritten.
- **Add by store link** — paste a roaster product URL and the app resolves the
  product page to its name, origin facts, and purchase options (bag sizes).
- **Photo auto-find** — bags without a snapshot can pull the real product
  image from the roaster's own store page (Shopify or WooCommerce product
  feeds, fuzzy-matched by name, tolerant of typos like "Guatamala" →
  "Guatemala"). One at a time, or a batch run for every missing photo.
- **AI photo scan** (add/edit forms, needs an OpenRouter key) — reads a coffee
  bag's label straight from its photo and proposes roaster, name, origin,
  variety, producer, elevation, process, roast level, blend/single-origin,
  decaf, tasting notes and notes. If the photo's roaster+name match a product
  in that roaster's store feed, that product page is read too and its facts
  (usually fuller) take priority over the photo's. Runs automatically when you
  pick a photo file, or on demand via "Scan photo for details" for a photo
  already on the coffee. Nothing is filled in automatically — a review dialog
  lists every field found with a checkbox, defaulting to all selected; only
  what you leave checked gets written into the form (overwriting existing
  values), and nothing is saved until you submit the form yourself.
- **Roasters** (`/roasters`) — a directory of every roaster you have bought
  from, auto-created the first time a bag names them (no manual "add roaster"
  step) — including bags added before this feature existed, which are
  backfilled into their own bare roaster row automatically on startup. Each
  has a name, logo, state/country, a short blurb, specialty and founded year,
  plus the count and grid of bags from them. Edit a roaster the same way you
  edit a bag, including "Update from a link" (paste the roaster's homepage
  and AI merges in profile details, logo included). Renaming a roaster
  updates every bag's `roaster` field to match. Deleting is blocked while any
  bag still references it — and the reverse happens automatically too: if
  deleting a bag or moving it to a different roaster leaves a roaster with no
  bags left, that now-empty roaster is removed on the spot.
- **Import** — Beanconqueror JSON export, Bean Vault JSON backup (photos
  included), or Bean Vault CSV.
- **Export** — a JSON backup with every photo embedded (restores into Bean
  Vault), or a CSV table for spreadsheets.
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

## Bag lifecycle

A bag is `resting` by default and moves through a small, intentional state
machine (`src/lib/status.ts`). Transitions from → to:

| From | To |
|---|---|
| `resting` | `frozen` (freeze), `opened` (open) |
| `frozen` | `resting` (unfreeze), `empty` |
| `opened` | `frozen` (freeze), `empty` |
| `empty` | `resting` (undo) |

- `resting` — the default. Resting days = days since roast, minus any time
  frozen. Stops accumulating once the bag is emptied.
- `frozen` — pauses the resting clock. Assumed to happen at most once per
  bag: frozen time is `frozenAt`→`unfrozenAt` (or `frozenAt`→today while
  still frozen), computed on the fly rather than stored. Unfreezing resumes
  resting.
- `opened` — tracks open days from `openedAt`. An opened bag can still be
  frozen.
- `empty` — terminal (set `emptiedAt`). Empties can be undone back to
  `resting`.

Transitioning happens on the coffee detail page; the button label reflects the
action (Freeze / Unfreeze / Open / Empty / Resting).

The edit form's (and grid's) raw `frozenAt`/`unfrozenAt` fields let you set a
freeze span directly instead of using the Freeze/Unfreeze buttons — resting
days is computed from whatever ends up stored there, so there's no separate
field to keep in sync. Since a bag is assumed frozen only once, re-freezing
(via either the buttons or these raw fields) overwrites the earlier span —
only the most recent freeze counts toward resting time.

## Importing from Beanconqueror

Imports live in **Settings → Import**.

1. In the Beanconqueror app: **Settings → Data & Storage → Export to JSON**.
2. In Bean Vault: **Settings → Import → Beanconqueror** → choose the file.
3. The result shows how many beans were imported, how many were skipped as
   already present, and whether the export contained any photos.

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
if a roaster enables a feed. This is a separate, still-hardcoded lookup for
photo auto-find — unrelated to the `roasters` table (`/roasters`), which
tracks roaster profiles, not store feeds.

## Data & backups

- Database: `data/coffee.db` (SQLite, WAL mode)
- Uploaded photos: `data/uploads/` (served through `/api/photos/[name]`)
- The whole `data/` directory is **gitignored** — it is your only copy.
  Back it up (the file is a single SQLite DB plus an images folder).

Beyond copying the volume, the app itself can get your data out and back in
(**Settings → Data / Import**):

- **Backup (JSON)** — `GET /api/export/json`. Every coffee plus its photo,
  and every roaster's profile plus its logo, all embedded as base64.
  Restoring the same file is idempotent — coffees upsert by id, roasters by
  name; anything missing from the backup is left untouched.
- **CSV** — `GET /api/export`. The plain table for spreadsheets. The CSV
  import honors an `id` column to update existing rows; photo names are only
  restored when the file is already present in `data/uploads/`.

Schema lives in `src/db/schema.ts`; migration SQL lives in `drizzle/` and is
applied automatically on startup. After changing the schema, regenerate with
`npx drizzle-kit generate`.

## Project layout

```
src/
  app/
    page.tsx                 # dashboard home (stats + analytics)
    layout.tsx               # header, nav menu, theme bootstrap
    new/                     # add a coffee (form + add-by-link)
    coffees/
      page.tsx               # collection: tiles + grid editing views
      [id]/                  # detail view (lifecycle, fields, notes)
      [id]/edit/             # edit a coffee
    roasters/
      page.tsx               # roaster directory
      [id]/                  # detail view (profile + bags from them)
      [id]/edit/             # edit a roaster
    settings/                # data export/import, AI key, API keys
    actions.ts               # server actions (create/update/delete/status/import/find)
    api/
      v1/coffees/            # REST API (list/create/update/delete)
      v1/roasters/           # REST API (list/create/update/delete)
      photos/[name]/         # serves uploaded photos
      export/                # CSV export
      export/json/           # JSON backup (photos embedded)
  components/                # dashboard, collection, grid editor, forms, toggles
  db/                        # schema (coffees + roasters) + SQLite client (auto-migrates)
  lib/                       # parsers, validation, photo + storefront lookup, AI, roasters.ts (find-or-create)
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
notes. This is an assisted draft; nothing is saved until you review. You can
also re-read an existing coffee's product page and merge in AI-extracted
details — that "Update from product link" tool lives on the edit page.

The add/edit forms can also **scan a coffee bag's photo** — see "AI photo
scan" above. It reuses the same OpenRouter key and, when it can match the
photo to a real product page, the same page-reading path as the link tools
above; the difference is the review dialog, which lets you pick exactly
which found fields to apply (including overwriting fields that already have
a value) rather than filling everything in automatically.

When the store page also says something about the roaster itself (state,
country, a short blurb, founded year, specialty), that gets read too — if the
bag's roaster is brand new, its profile is filled in automatically alongside
the coffee's own fields. An existing roaster's profile is never overwritten
this way. On a roaster's own edit page, "Update from a link" re-reads a
pasted URL (its homepage, not a product page) the same way "Update from
product link" does for a coffee — merge-only, and it also fetches a logo and
sets the website field (to the link's own domain) if the roaster does not
have one yet.

The key can be managed from the app itself: **Settings** saves it in the
local settings table — server-side only, never sent to the browser and never
included in exports. Alternatively set `OPENROUTER_API_KEY` in `.env.local`
(see `.env.example`) as a fallback. Optional `OPENROUTER_MODEL` overrides the
default `openai/gpt-4o-mini`.

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
| `/api/v1/coffees/:id` | PATCH | fields to change | Merge-update; `null` clears a field. Changing `roaster` also removes the old roaster if it is left with no bags |
| `/api/v1/coffees/:id` | DELETE | — | Delete (also removes its photo file and, if it was the roaster's last bag, that now-empty roaster) |
| `/api/v1/roasters` | GET | — | List all roasters (by name) |
| `/api/v1/roasters` | POST | roaster fields | Create. `409` if the name already exists (case-insensitive) |
| `/api/v1/roasters/:id` | GET | — | Get one roaster |
| `/api/v1/roasters/:id` | PATCH | fields to change | Merge-update; renaming `name` also updates every coffee's `roaster` field to match |
| `/api/v1/roasters/:id` | DELETE | — | Delete (also removes its logo). `409` while any coffee still references it |

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
| `roasterId` | `integer \| null` | Auto-linked to `/api/v1/roasters` by matching `roaster` (case-insensitive); a new roaster row is created if none matches. |
| `origin` | `string \| null` | Always derived from `country` + `region`; never accepted directly. |
| `status` | `string` | Bag lifecycle: `resting`, `frozen`, `opened`, or `empty`. Managed via the app, not the API. |
| `openedAt` | `string \| null` | `YYYY-MM-DD` the bag was first opened. |
| `emptiedAt` | `string \| null` | `YYYY-MM-DD` the bag was emptied (terminal). |
| `frozenAt` | `string \| null` | `YYYY-MM-DD` the (single) freeze began. |
| `unfrozenAt` | `string \| null` | `YYYY-MM-DD` that freeze ended. |
| `aiEnriched` | `boolean` | Set when the AI assisted an entry. |
| `sourceUuid` | `string \| null` | Beanconqueror import id (dedupe). |
| `photoFile` | `string \| null` | Stored photo filename; manage photos via `photoUrl`. |
| `createdAt` / `updatedAt` | `string` (ISO 8601) | Server-managed timestamps. |

**Sample response** (`GET /api/v1/coffees/:id`):

```json
{
  "id": 121,
  "roaster": "S&W Craft Roasting",
  "roasterId": 4,
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
  "status": "resting",
  "openedAt": null,
  "emptiedAt": null,
  "frozenAt": null,
  "unfrozenAt": null,
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

**Roaster fields** (`/api/v1/roasters`), same writable/read-only split as above:

| Key | Type | Constraints / format |
|---|---|---|
| `name` | `string` | 1–200 chars. **Required on create**; cannot be emptied via PATCH; must be unique (case-insensitive). |
| `website` | `string \| null` | ≤ 500 chars. |
| `state` | `string \| null` | ≤ 100 chars. |
| `country` | `string \| null` | ≤ 100 chars. |
| `specialty` | `string \| null` | ≤ 200 chars. |
| `description` | `string \| null` | ≤ 2000 chars. |
| `foundedYear` | `integer \| null` | 1600–current year. |
| `logoUrl` | `string \| null` | Write-only. POST: server downloads and stores the image. PATCH: replaces the logo; `null` or `""` removes it. Never returned. |
| `id` | `integer` | Read-only. URI id (`/api/v1/roasters/:id`). |
| `logoFile` | `string \| null` | Read-only. Stored logo filename; manage via `logoUrl`. |
| `aiEnriched` | `boolean` | Read-only. Set when AI filled the profile. |
| `sourceUrl` | `string \| null` | Read-only. Last URL used for AI enrichment. |
| `createdAt` / `updatedAt` | `string` (ISO 8601) | Read-only, server-managed. |

### Errors

Non-2xx responses are JSON: `{"error": "…"}` — and validation failures add an
`errors` array listing each problem, e.g.
`422 {"error":"Validation failed.","errors":["priceCents must be an integer
number of cents (no commas)."]}`. Common codes: 401 unauthenticated, 404 not
found, 400 bad JSON, 422 validation.
