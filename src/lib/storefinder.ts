/**
 * Product-image lookup from roaster storefronts.
 *
 * Shopify stores expose /products.json; WooCommerce stores expose the
 * wp-json/wc/store/products REST API. We match the imported coffee name against
 * real product titles (fuzzy, typo-tolerant) and return the product's main
 * image URL, which is exactly the picture on the store page for that bag.
 * Product lists are cached in-process for 10 minutes.
 */

export type StoreKind = "shopify" | "woocommerce";
export type Store = { kind: StoreKind; domain: string };
export type StoreProduct = { title: string; imageUrl: string | null };

/** Verified storefront feeds, keyed by compacted roaster name. */
const ROASTER_STORES: Record<string, Store> = {
  happymug: { kind: "shopify", domain: "happymugcoffee.com" },
  happymugcoffee: { kind: "shopify", domain: "happymugcoffee.com" },
  happymugcoffeelab: { kind: "shopify", domain: "happymugcoffee.com" },
  perccoffee: { kind: "shopify", domain: "perccoffee.com" },
  perc: { kind: "shopify", domain: "perccoffee.com" },
  seycoffee: { kind: "shopify", domain: "seycoffee.com" },
  sey: { kind: "shopify", domain: "seycoffee.com" },
  counterculturecoffee: { kind: "shopify", domain: "counterculturecoffee.com" },
  counterculture: { kind: "shopify", domain: "counterculturecoffee.com" },
  dailyrisecoffee: { kind: "shopify", domain: "dailyrisecoffee.com" },
  dailyrise: { kind: "shopify", domain: "dailyrisecoffee.com" },
  blackwhitecoffeeroasters: { kind: "shopify", domain: "blackwhiteroasters.com" },
  blackwhiteroasters: { kind: "shopify", domain: "blackwhiteroasters.com" },
  blackwhite: { kind: "shopify", domain: "blackwhiteroasters.com" },
  wasatchroastingcompany: { kind: "woocommerce", domain: "www.wasatchroasting.com" },
  wasatchroasting: { kind: "woocommerce", domain: "www.wasatchroasting.com" },
  wasatch: { kind: "woocommerce", domain: "www.wasatchroasting.com" },
};

export function storeFor(roaster: string): Store | null {
  const key = roaster.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return ROASTER_STORES[key] ?? null;
}

const FETCH_TIMEOUT_MS = 20_000;

async function fetchJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "coffee-tracker/0.1 (personal coffee log)" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function unescapeHtml(s: string): string {
  const entities: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", ldquo: "“", rdquo: "”",
  };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|ldquo|rdquo);/g, (m, e: string) => entities[e] ?? m);
}

function parseShopifyProducts(data: unknown): StoreProduct[] {
  if (typeof data !== "object" || data === null || !("products" in data)) return [];
  const raw = data.products;
  if (!Array.isArray(raw)) return [];
  const out: StoreProduct[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>; // JSON object, shape checked field-by-field below
    const title = typeof rec.title === "string" ? rec.title : "";
    const images = Array.isArray(rec.images) ? rec.images : [];
    const first = images[0];
    const src =
      typeof first === "object" && first !== null && "src" in first && typeof first.src === "string"
        ? first.src
        : null;
    out.push({ title, imageUrl: src });
  }
  return out;
}

async function fetchShopifyProducts(domain: string): Promise<StoreProduct[]> {
  const products: StoreProduct[] = [];
  for (let page = 1; page <= 12; page++) {
    const data = await fetchJson(`https://${domain}/products.json?limit=250&page=${page}`);
    const batch = parseShopifyProducts(data);
    if (batch.length === 0) break;
    products.push(...batch);
    if (batch.length < 250) break;
  }
  return products;
}

async function fetchWooProducts(domain: string): Promise<StoreProduct[]> {
  const data = await fetchJson(`https://${domain}/wp-json/wc/store/products?per_page=100`);
  if (!Array.isArray(data)) return [];
  const out: StoreProduct[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>; // JSON object, shape checked below
    const title = typeof rec.name === "string" ? unescapeHtml(rec.name) : "";
    const images = Array.isArray(rec.images) ? rec.images : [];
    const first = images[0];
    const src =
      typeof first === "object" && first !== null && "src" in first && typeof first.src === "string"
        ? first.src.split("?")[0]
        : null;
    out.push({ title, imageUrl: src });
  }
  return out;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const productCache = new Map<string, { at: number; products: StoreProduct[] }>();

export async function storeProducts(store: Store): Promise<StoreProduct[]> {
  const key = `${store.kind}:${store.domain}`;
  const hit = productCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.products;

  const products =
    store.kind === "shopify" ? await fetchShopifyProducts(store.domain) : await fetchWooProducts(store.domain);
  if (products.length > 0) {
    productCache.set(key, { at: Date.now(), products });
  } else {
    productCache.delete(key);
  }
  return products;
}

/* ---------- fuzzy title matching ---------- */

function normalizeTokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

function tokenMatches(q: string, t: string): boolean {
  if (q === t) return true;
  if (Math.abs(q.length - t.length) > 2) return false;
  if (levenshtein(q, t) <= 2) return true;
  const min = Math.min(q.length, t.length);
  return min >= 4 && (q.startsWith(t) || t.startsWith(q));
}

/** Pick the product whose title best covers the coffee name. */
export function bestMatch(name: string, products: StoreProduct[]): StoreProduct | null {
  const q = normalizeTokens(name);
  if (q.length === 0) return null;
  const need = q.length <= 2 ? q.length : Math.max(2, Math.floor(q.length * 0.75));

  let best: StoreProduct | null = null;
  let bestScore = -1;
  let bestDist = Infinity;
  for (const p of products) {
    if (!p.imageUrl) continue;
    const t = normalizeTokens(p.title);
    if (t.length === 0) continue;
    const matched = q.filter((qt) => t.some((tt) => tokenMatches(qt, tt))).length;
    if (matched < need) continue;
    const dist = Math.abs(t.length - q.length);
    if (matched > bestScore || (matched === bestScore && dist < bestDist)) {
      bestScore = matched;
      bestDist = dist;
      best = p;
    }
  }
  return best;
}