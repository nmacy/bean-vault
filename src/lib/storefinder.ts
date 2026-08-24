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
export type Store = { kind: StoreKind; domain: string; displayName: string };
export type StoreProduct = {
  title: string;
  imageUrl: string | null;
  slug?: string;
  priceCents?: number | null;
  weightGrams?: number | null;
  /** The store's own product page for this item, when derivable from the feed. */
  productUrl?: string | null;
};

export type StoreVariant = {
  id: string;
  label: string;
  priceCents: number | null;
  weightGrams: number | null;
};

export type StoreProductDetail = {
  roaster: string;
  name: string;
  imageUrl: string | null;
  variants: StoreVariant[];
};

/** Verified storefront feeds, keyed by compacted roaster name. */
const ROASTER_STORES: Record<string, Store> = {
  happymug: { kind: "shopify", domain: "happymugcoffee.com", displayName: "Happy Mug" },
  happymugcoffee: { kind: "shopify", domain: "happymugcoffee.com", displayName: "Happy Mug" },
  happymugcoffeelab: { kind: "shopify", domain: "happymugcoffee.com", displayName: "Happy Mug" },
  perccoffee: { kind: "shopify", domain: "perccoffee.com", displayName: "Perc" },
  perc: { kind: "shopify", domain: "perccoffee.com", displayName: "Perc" },
  seycoffee: { kind: "shopify", domain: "seycoffee.com", displayName: "Sey" },
  sey: { kind: "shopify", domain: "seycoffee.com", displayName: "Sey" },
  counterculturecoffee: { kind: "shopify", domain: "counterculturecoffee.com", displayName: "Counter Culture Coffee" },
  counterculture: { kind: "shopify", domain: "counterculturecoffee.com", displayName: "Counter Culture Coffee" },
  dailyrisecoffee: { kind: "shopify", domain: "dailyrisecoffee.com", displayName: "Daily Rise Coffee" },
  dailyrise: { kind: "shopify", domain: "dailyrisecoffee.com", displayName: "Daily Rise Coffee" },
  blackwhitecoffeeroasters: { kind: "shopify", domain: "blackwhiteroasters.com", displayName: "Black & White Coffee Roasters" },
  blackwhiteroasters: { kind: "shopify", domain: "blackwhiteroasters.com", displayName: "Black & White Coffee Roasters" },
  blackwhite: { kind: "shopify", domain: "blackwhiteroasters.com", displayName: "Black & White Coffee Roasters" },
  wasatchroastingcompany: { kind: "woocommerce", domain: "www.wasatchroasting.com", displayName: "Wasatch Roasting Company" },
  wasatchroasting: { kind: "woocommerce", domain: "www.wasatchroasting.com", displayName: "Wasatch Roasting Company" },
  wasatch: { kind: "woocommerce", domain: "www.wasatchroasting.com", displayName: "Wasatch Roasting Company" },
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

function parseShopifyProducts(data: unknown, domain: string): StoreProduct[] {
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
    const handle = typeof rec.handle === "string" ? rec.handle : null;
    out.push({ title, imageUrl: src, productUrl: handle ? `https://${domain}/products/${handle}` : null });
  }
  return out;
}

async function fetchShopifyProducts(domain: string): Promise<StoreProduct[]> {
  const products: StoreProduct[] = [];
  for (let page = 1; page <= 12; page++) {
    const data = await fetchJson(`https://${domain}/products.json?limit=250&page=${page}`);
    const batch = parseShopifyProducts(data, domain);
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
    const prices =
      typeof rec.prices === "object" && rec.prices !== null ? (rec.prices as Record<string, unknown>) : {};
    const priceCents =
      typeof prices.price === "string" && /^\d+$/.test(prices.price) ? Number(prices.price) : null;
    const dimensions =
      typeof rec.dimensions === "object" && rec.dimensions !== null
        ? (rec.dimensions as Record<string, unknown>)
        : {};
    const unit = typeof dimensions.unit === "string" ? dimensions.unit : "kg";
    let weightGrams: number | null = null;
    if (typeof dimensions.weight === "string" && /^[\d.]+$/.test(dimensions.weight) && Number(dimensions.weight) > 0) {
      const w = Number(dimensions.weight);
      weightGrams = Math.round(unit === "g" ? w : w * 1000);
    }
    out.push({
      title,
      imageUrl: src,
      slug: typeof rec.slug === "string" ? rec.slug : undefined,
      priceCents,
      weightGrams,
      productUrl: typeof rec.permalink === "string" ? rec.permalink : null,
    });
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

/* ---------- product-page lookup (add-by-link) ---------- */

export type StorePageRef = {
  store: Store;
  handle: string | null;
  slug: string | null;
  variantId: string | null;
};

export function parseStoreUrl(url: string): StorePageRef | { error: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { error: "That doesn't look like a valid URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { error: "Use an http(s) product link." };
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const store = Object.values(ROASTER_STORES).find(
    (s) => s.domain.toLowerCase().replace(/^www\./, "") === host,
  );
  if (!store) return { error: `No store feed known for ${u.hostname}.` };

  if (store.kind === "shopify") {
    const match = u.pathname.match(/^\/products\/([^/]+)/);
    if (!match) return { error: "That URL is not a product page." };
    return {
      store,
      handle: decodeURIComponent(match[1].split("?")[0]),
      slug: null,
      variantId: u.searchParams.get("variant"),
    };
  }
  const parts = u.pathname.split("/").filter(Boolean);
  const slug = parts.length > 0 ? decodeURIComponent(parts[parts.length - 1]) : null;
  return { store, handle: null, slug, variantId: null };
}

type RawShopifyProduct = Record<string, unknown>;

async function fetchShopifyProduct(domain: string, handle: string): Promise<RawShopifyProduct | null> {
  const data = await fetchJson(`https://${domain}/products/${encodeURIComponent(handle)}.json`);
  if (typeof data !== "object" || data === null || !("product" in data)) return null;
  const product = data.product;
  return typeof product === "object" && product !== null ? (product as RawShopifyProduct) : null;
}

function parseShopifyDetail(product: RawShopifyProduct, displayName: string): StoreProductDetail | null {
  const name = typeof product.title === "string" ? product.title.trim() : "";
  if (!name) return null;
  const images = Array.isArray(product.images) ? product.images : [];
  const imageUrl =
    typeof images[0] === "object" && images[0] !== null && "src" in images[0] && typeof images[0].src === "string"
      ? images[0].src
      : null;
  const rawVariants = Array.isArray(product.variants) ? product.variants : [];
  const variants: StoreVariant[] = [];
  for (const v of rawVariants) {
    if (typeof v !== "object" || v === null) continue;
    const rec = v as Record<string, unknown>;
    const title = typeof rec.title === "string" ? rec.title.trim() : "";
    const price = typeof rec.price === "string" && /^[\d.]+$/.test(rec.price) ? Number(rec.price) : null;
    const grams = typeof rec.grams === "number" && rec.grams > 0 ? rec.grams : null;
    const label =
      title && title !== "Default Title"
        ? title
        : grams
          ? `${grams} g`
          : "Default";
    variants.push({
      id: String(rec.id ?? `v${variants.length}`),
      label,
      priceCents: price !== null && Number.isFinite(price) ? Math.round(price * 100) : null,
      weightGrams: grams,
    });
  }
  if (variants.length === 0) {
    variants.push({ id: "default", label: "Default", priceCents: null, weightGrams: null });
  }
  const vendor = typeof product.vendor === "string" && product.vendor.trim() ? product.vendor.trim() : displayName;
  return { roaster: vendor, name, imageUrl, variants };
}

/**
 * Resolve a store product-page URL to the product plus its purchase options
 * (e.g. bag sizes). Shopify: /products/{handle}.json carries full variants;
 * WooCommerce: the store feed (slug + price + weight) is enough for one option.
 */
export async function lookupProductPage(url: string): Promise<StoreProductDetail | { error: string }> {
  const ref = parseStoreUrl(url);
  if ("error" in ref) return ref;

  if (ref.store.kind === "shopify") {
    if (!ref.handle) return { error: "This link is not a product page." };
    const product = await fetchShopifyProduct(ref.store.domain, ref.handle);
    if (!product) return { error: "Could not read that product from the store." };
    const detail = parseShopifyDetail(product, ref.store.displayName);
    if (!detail) return { error: "The store returned an empty product." };
    if (ref.variantId && !detail.variants.some((v) => v.id === ref.variantId)) {
      return { error: "The ?variant= in the link does not match this product." };
    }
    return detail;
  }

  const products = await storeProducts(ref.store);
  const product = ref.slug
    ? products.find((p) => p.slug === ref.slug)
    : null;
  if (!product) return { error: "Could not find that product in the store." };
  return {
    roaster: ref.store.displayName,
    name: product.title,
    imageUrl: product.imageUrl,
    variants: [
      {
        id: "default",
        label: product.weightGrams ? `${product.weightGrams} g` : "Default",
        priceCents: product.priceCents ?? null,
        weightGrams: product.weightGrams ?? null,
      },
    ],
  };
}