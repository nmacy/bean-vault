/**
 * Shared filtering/sorting for the coffees collection — used by both the
 * tiles view and the grid view so the two stay behaviorally identical and
 * share persisted state (src/components/collection-view.tsx).
 */

export const ROAST_LEVELS = ["light", "medium-light", "medium", "medium-dark", "dark"] as const;
export type RoastLevel = (typeof ROAST_LEVELS)[number];
const ROAST_ORDER = new Map(ROAST_LEVELS.map((l, i) => [l, i]));

export type SortKey =
  | "roaster"
  | "name"
  | "country"
  | "region"
  | "variety"
  | "producer"
  | "elevation"
  | "process"
  | "mix"
  | "roastLevel"
  | "roastDate"
  | "purchaseDate"
  | "status"
  | "openedAt"
  | "frozenAt"
  | "unfrozenAt"
  | "emptiedAt"
  | "frozenDays"
  | "price"
  | "weight"
  | "rating"
  | "decaf";

export const SORT_KEYS: readonly SortKey[] = [
  "roaster", "name", "country", "region", "variety", "producer", "elevation",
  "process", "mix", "roastLevel", "roastDate", "purchaseDate", "status",
  "openedAt", "frozenAt", "unfrozenAt", "emptiedAt", "frozenDays", "price",
  "weight", "rating", "decaf",
];

export type SortSpec = { key: SortKey; dir: 1 | -1 } | null;

export type CoffeeFilters = {
  search: string;
  roaster: string;
  roast: string;
  rating: string;
  year: string;
  decaf: string;
};

export function emptyFilters(): CoffeeFilters {
  return { search: "", roaster: "", roast: "", rating: "", year: "", decaf: "" };
}

export function hasActiveFilters(f: CoffeeFilters): boolean {
  return Boolean(f.search || f.roaster || f.roast || f.rating || f.year || f.decaf);
}

/** Bag year: roast date primarily (the vintage), purchase date as fallback. */
export function yearOf(c: { roastDate: string | null; purchaseDate: string | null }): string | null {
  return (c.roastDate ?? "").slice(0, 4) || (c.purchaseDate ?? "").slice(0, 4) || null;
}

/** Fields matchesFilters/compareCoffees need — BeanItem and the grid's row both satisfy this. */
export type FilterableCoffee = {
  roaster: string;
  name: string;
  country: string | null;
  region: string | null;
  mix: string | null;
  variety: string | null;
  producer: string | null;
  elevation: string | null;
  process: string | null;
  roastLevel: string | null;
  roastDate: string | null;
  purchaseDate: string | null;
  status: string;
  openedAt: string | null;
  frozenAt: string | null;
  unfrozenAt: string | null;
  emptiedAt: string | null;
  frozenDays: number;
  priceCents: number | null;
  weightGrams: number | null;
  rating: number | null;
  decaffeinated: boolean;
};

export function matchesFilters(c: FilterableCoffee, f: CoffeeFilters): boolean {
  const q = f.search.trim().toLowerCase();
  if (q) {
    const haystack = [c.roaster, c.name, c.country, c.region, c.variety, c.producer, c.process]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toLowerCase());
    if (!haystack.some((v) => v.includes(q))) return false;
  }
  if (f.roaster && c.roaster !== f.roaster) return false;
  if (f.roast) {
    if (f.roast === "__none__" ? Boolean(c.roastLevel) : c.roastLevel !== f.roast) return false;
  }
  if (f.rating) {
    if (f.rating === "none" ? c.rating != null : c.rating !== Number(f.rating)) return false;
  }
  if (f.year) {
    const y = yearOf(c);
    if (f.year === "__none__" ? y !== null : y !== f.year) return false;
  }
  if (f.decaf === "yes" && !c.decaffeinated) return false;
  if (f.decaf === "no" && c.decaffeinated) return false;
  return true;
}

export function filterCoffees<T extends FilterableCoffee>(list: T[], f: CoffeeFilters): T[] {
  return list.filter((c) => matchesFilters(c, f));
}

export function compareCoffees(a: FilterableCoffee, b: FilterableCoffee, sort: SortSpec): number {
  if (!sort) return 0;
  const { key, dir } = sort;
  let va: unknown;
  let vb: unknown;
  switch (key) {
    case "price":
      va = a.priceCents;
      vb = b.priceCents;
      break;
    case "weight":
      va = a.weightGrams;
      vb = b.weightGrams;
      break;
    case "rating":
      va = a.rating;
      vb = b.rating;
      break;
    case "decaf":
      va = a.decaffeinated ? 1 : 0;
      vb = b.decaffeinated ? 1 : 0;
      break;
    case "roastLevel":
      va = a.roastLevel ? ROAST_ORDER.get(a.roastLevel as RoastLevel) : null;
      vb = b.roastLevel ? ROAST_ORDER.get(b.roastLevel as RoastLevel) : null;
      break;
    default:
      va = a[key];
      vb = b[key];
  }
  const na = va == null || va === "";
  const nb = vb == null || vb === "";
  if (na && nb) return 0;
  if (na) return 1;
  if (nb) return -1;
  if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
  return String(va).localeCompare(String(vb)) * dir;
}

export function sortCoffees<T extends FilterableCoffee>(list: T[], sort: SortSpec): T[] {
  if (!sort) return list;
  return [...list].sort((a, b) => compareCoffees(a, b, sort));
}

/* ---------- persisted state (localStorage keys + pure parsers) ----------
 * Reading/writing itself goes through useLocalStorageState (a React hook,
 * see src/lib/use-local-storage-state.ts) so it stays hydration-safe —
 * these are just the pure "is this raw string a valid CoffeeFilters/SortSpec"
 * parsers it needs, kept here next to the types they parse.
 */

export const FILTERS_KEY = "bean-vault:coffee-filters";
export const SORT_KEY = "bean-vault:coffee-sort";

export function parseFilters(raw: string): CoffeeFilters | null {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  return {
    search: typeof p.search === "string" ? p.search : "",
    roaster: typeof p.roaster === "string" ? p.roaster : "",
    roast: typeof p.roast === "string" ? p.roast : "",
    rating: typeof p.rating === "string" ? p.rating : "",
    year: typeof p.year === "string" ? p.year : "",
    decaf: typeof p.decaf === "string" ? p.decaf : "",
  };
}

export function parseSort(raw: string): SortSpec | null {
  const parsed: unknown = JSON.parse(raw);
  if (
    parsed &&
    typeof parsed === "object" &&
    typeof (parsed as { key?: unknown }).key === "string" &&
    ((parsed as { dir?: unknown }).dir === 1 || (parsed as { dir?: unknown }).dir === -1) &&
    (SORT_KEYS as readonly string[]).includes((parsed as { key: string }).key)
  ) {
    return { key: (parsed as { key: SortKey }).key, dir: (parsed as { dir: 1 | -1 }).dir };
  }
  return null;
}
