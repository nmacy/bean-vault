/**
 * AI enrichment of roaster product pages via OpenRouter.
 *
 * The server fetches the store page, strips it down to plain text, and asks
 * the model for structured coffee facts. The key lives only server-side
 * (process.env.OPENROUTER_API_KEY) and is never sent to the client.
 */

export const DEFAULT_MODEL = "openai/gpt-4o-mini";
const PAGE_FETCH_TIMEOUT_MS = 25_000;
const AI_TIMEOUT_MS = 60_000;
const MAX_PAGE_CHARS = 30_000;

export const ROAST_LEVELS = ["light", "medium-light", "medium", "medium-dark", "dark"];

export type AiCoffeeFields = {
  country: string | null;
  region: string | null;
  variety: string | null;
  producer: string | null;
  elevation: string | null;
  process: string | null;
  roastLevel: string | null;
  mix: string | null; // "blend" | "single-origin"
  decaffeinated: boolean;
  tastingNotes: string | null;
  description: string | null;
};

/** Roaster-level facts opportunistically pulled off a product page, if present. */
export type AiRoasterFields = {
  state: string | null;
  country: string | null;
  description: string | null;
  foundedYear: number | null;
  specialty: string | null;
};

function decodeEntities(v: string): string {
  return v.replace(/&(?:#0?39;|quot;|amp;|lt;|gt;|nbsp;|rsquo;|ldquo;|rdquo;)/g, (m) =>
    ({ "&#39;": "'", "&#039;": "'", "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&rsquo;": "’", "&ldquo;": "“", "&rdquo;": "”" })[m] ?? m,
  );
}

function flattenLd(value: unknown, out: string[]): void {
  if (typeof value === "string") out.push(decodeEntities(value));
  else if (Array.isArray(value)) for (const v of value) flattenLd(v, out);
  else if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) flattenLd(v, out);
  }
}

function htmlToText(html: string): string {
  const extras: string[] = [];
  // JSON-LD (product schema) is where many JS-rendered stores keep the real copy.
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      flattenLd(JSON.parse(m[1]), extras);
    } catch {
      extras.push(m[1].replace(/<[^>]+>/g, " "));
    }
  }
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
  if (desc) extras.push(desc[1].replace(/&amp;/g, "&"));

  const content = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .concat(" ", extras.join(" "))
    .replace(/\s+/g, " ")
    .trim();
  return content.slice(0, MAX_PAGE_CHARS);
}

export async function fetchPageText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "coffee-tracker/0.1 (personal coffee log)" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return htmlToText(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Pull the first JSON of a text (tolerates fences, prose, trailing garbage). */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const text = fenced[1].trim();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        /* fall through to a balanced scan of the fence text */
      }
      const inner = scanBalancedObject(text);
      if (inner !== null) return inner;
    }
  }
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through */
    }
  }
  return scanBalancedObject(raw);
}

/** Scan for the first brace-balanced JSON object, honoring strings and escapes. */
function scanBalancedObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Agtron roast-color number → roast level (higher = lighter). */
function agtronToRoast(n: number): string | null {
  if (n >= 76) return "light";
  if (n >= 65) return "medium-light";
  if (n >= 55) return "medium";
  if (n >= 45) return "medium-dark";
  if (n >= 20) return "dark";
  return null;
}

/** Best-effort tasting notes straight from page text ("Tasting notes: sweet citrus…"). */
function findTastingNotes(text: string): string | null {
  const m = text.match(
    /(?:tasting|flavor|flavour|cup)\s*(?:notes?|profile)\s*[:\u2014\-]?\s*([A-Za-z][^.;]{20,340})/i,
  );
  if (!m) return null;
  let s = m[1].trim();
  // stop at common page-layout words that follow the description
  const stop = s.match(/\b(price|weight|size|add to cart|roast|altitude|origin|shipping)\b/i);
  if (stop && stop.index !== undefined && stop.index > 20) s = s.slice(0, stop.index);
  s = s.trim().replace(/\s{2,}/g, " ").replace(/\.$/, "");
  return s.length >= 12 ? s : null;
}

/**
 * Many storefront CDNs (Shopify's in particular) resize an image on the fly
 * via width/height query params \u2014 a favicon <link> often points at a tiny
 * 32x32 crop of an otherwise crisp, much larger master image. Stripping
 * those params serves the original file instead.
 */
function fullResolutionIcon(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("width");
    u.searchParams.delete("height");
    u.searchParams.delete("crop");
    return u.toString();
  } catch {
    return url;
  }
}

/** Every <link rel="\u2026icon\u2026"> tag on the page, resolved to absolute, full-resolution URLs. */
function extractIconLinks(html: string, baseUrl: string): { href: string; isAppleTouch: boolean; area: number }[] {
  const icons: { href: string; isAppleTouch: boolean; area: number }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!rel || !href) continue;
    const tokens = rel.split(/\s+/);
    if (!tokens.some((t) => t.includes("icon"))) continue;
    const sizes = tag.match(/\bsizes=["']([^"']+)["']/i)?.[1]?.match(/(\d+)x(\d+)/i);
    const area = sizes ? Number(sizes[1]) * Number(sizes[2]) : 0;
    try {
      icons.push({
        href: fullResolutionIcon(new URL(href, baseUrl).toString()),
        isAppleTouch: tokens.some((t) => t.startsWith("apple-touch-icon")),
        area,
      });
    } catch {
      /* malformed href, skip */
    }
  }
  return icons;
}

/**
 * Every icon candidate on the page, best quality first: apple-touch-icon
 * (usually a clean square logo mark, unlike a tiny favicon.ico) before plain
 * favicons, largest declared `sizes` first within each group. Ranked (rather
 * than a single pick) so a broken/404 link \u2014 theme cruft is common \u2014 can be
 * skipped in favor of the next-best candidate instead of losing the logo.
 */
function rankIcons(icons: { href: string; isAppleTouch: boolean; area: number }[]): string[] {
  const sorted = [...icons].sort((a, b) =>
    a.isAppleTouch !== b.isAppleTouch ? (a.isAppleTouch ? -1 : 1) : b.area - a.area,
  );
  return [...new Set(sorted.map((i) => i.href))];
}

/** Page metadata for feed-less stores: og:title (or <title>), og:image, and ranked icon candidates. */
export async function fetchPageMeta(
  url: string,
): Promise<{ title: string | null; image: string | null; icon: string | null; icons: string[] }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "coffee-tracker/0.1 (personal coffee log)" },
      signal: ctrl.signal,
    });
    if (!res.ok) return { title: null, image: null, icon: null, icons: [] };
    const html = await res.text();
    const meta = (name: string) => {
      const m = html.match(
        new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)`, "i"),
      );
      return m ? m[1].replace(/&amp;/g, "&").trim() : null;
    };
    let title = meta("og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
    if (title) {
      // Drop trailing brand bits: "Colombia Villa Betulia | S&W Craft Roasting"
      const parts = title.split(/\s[|\u2014\u2013\u2012-]\s/);
      title = parts[0].trim();
      if (!title) title = null;
    }
    const icons = rankIcons(extractIconLinks(html, url));
    return { title, image: meta("og:image"), icon: icons[0] ?? null, icons };
  } catch {
    return { title: null, image: null, icon: null, icons: [] };
  } finally {
    clearTimeout(timer);
  }
}

/** "1,900–2,100 masl" (or ft) -> unit-less meters: "1,900–2,100". */
function normalizeElevation(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const feet = /\b(ft|feet|foot)\b/i.test(t);
  const nums = t.match(/\d[\d,.]*/g);
  if (!nums) return null;
  const converted: string[] = [];
  for (const n of nums) {
    const raw = Number(n.replace(/,/g, ""));
    if (!Number.isFinite(raw)) continue;
    const meters = feet ? Math.round(raw * 0.3048) : Math.round(raw);
    converted.push(meters.toLocaleString("en-US"));
  }
  return converted.length > 0 ? converted.join("–") : null;
}

/** Best-effort elevation straight from page text ("1,900–2,100 masl"). */
function findElevation(text: string): string | null {
  const m = text.match(
    /(?:elevation|altitude)\D{0,60}([\d][\d,.]*(?:\s*[-–—to]\s*[\d][\d,.]*)?)\s*(masl|meters|m\.a\.s\.l|m)/i,
  ) ?? text.match(/([\d][\d,.]*(?:\s*[-–—]\s*[\d][\d,.]*)?)\s*(masl|m\.a\.s\.l)(?:\.|\s|,|$)/i);
  if (!m) return null;
  return `${m[1]} ${m[2].toLowerCase().replace(".", "")}`;
}

/** Agtron number from page text ("Agtron 63", "agatron #57"). */
function findAgtron(text: string): number | null {
  const m = text.match(/aga?t?t?r?on\D{0,12}(?:#|no\.?)?\s*(\d{2,3})/i) ?? text.match(/(?:agat?t?ron|a-gt)\s*:\s*(\d{2,3})/i);
  return m ? Number(m[1]) : null;
}

function cleanString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function parseFields(data: unknown): AiCoffeeFields {
  const rec = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  let roastLevel = cleanString(rec.roastLevel)?.toLowerCase() ?? null;
  if (roastLevel && !ROAST_LEVELS.includes(roastLevel)) {
    // tolerate model variants like "light-medium" or "medium dark"
    const fuzzy = roastLevel.replace(/[-_\s]/g, "");
    const hit = ROAST_LEVELS.find((l) => l.replace(/-/g, "") === fuzzy || l.startsWith(fuzzy.slice(0, 6)));
    roastLevel = hit ?? null;
  }
  const agtronRaw = cleanString(rec.agtron);
  const agtron = agtronRaw ? Number(agtronRaw.replace(/[^\d]/g, "")) : null;
  if (!roastLevel && agtron !== null && Number.isFinite(agtron)) {
    roastLevel = agtronToRoast(agtron);
  }
  const mixRaw = cleanString(rec.mix)?.toLowerCase() ?? null;
  const mix =
    mixRaw === "blend" || mixRaw?.includes("blend") && !mixRaw?.includes("single")
      ? "blend"
      : mixRaw === "single origin" || mixRaw === "single-origin" || mixRaw === "single"
        ? "single-origin"
        : null;
  const decafRaw = rec.decaffeinated ?? rec.decaf;
  const decaf =
    decafRaw === true || ["yes", "true", "1", "decaffeinated", "decaf"].includes(String(decafRaw).toLowerCase());

  return {
    country: cleanString(rec.country),
    region: cleanString(rec.region),
    variety: cleanString(rec.variety),
    producer: cleanString(rec.producer),
    elevation: normalizeElevation(cleanString(rec.elevation) ?? ""),
    process: cleanString(rec.process),
    roastLevel,
    mix,
    decaffeinated: decaf,
    tastingNotes: cleanString(
      rec.tastingNotes ??
        rec.tasting_notes ??
        rec.tastingnote ??
        rec.flavorNotes ??
        rec.flavor_notes ??
        rec.flavour_notes ??
        rec.flavor,
    ),
    description: cleanString(rec.description),
  };
}

function parseRoasterFields(data: unknown): AiRoasterFields {
  const rec = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  const yearRaw = cleanString(rec.roasterFoundedYear);
  const year = yearRaw ? Number(yearRaw.replace(/[^\d]/g, "")) : null;
  return {
    state: cleanString(rec.roasterState),
    country: cleanString(rec.roasterCountry),
    description: cleanString(rec.roasterDescription),
    foundedYear: year !== null && Number.isFinite(year) && year >= 1600 && year <= 2100 ? year : null,
    specialty: cleanString(rec.roasterSpecialty),
  };
}

/** Public model catalog from OpenRouter (id list for the model picker). */
export async function openRouterModels(): Promise<string[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: ctrl.signal });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null || !Array.isArray((data as Record<string, unknown>).data)) {
      return [];
    }
    const models = (data as Record<string, unknown>).data as { id?: unknown }[];
    return models
      .map((m) => (typeof m === "object" && m !== null && typeof (m as Record<string, unknown>).id === "string" ? ((m as Record<string, unknown>).id as string) : ""))
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export type EnrichResult =
  | { ok: true; fields: AiCoffeeFields; roaster: AiRoasterFields }
  | { ok: false; message: string };

/** A chat-completion call to OpenRouter, returning the assistant's raw text content. */
async function callOpenRouterChat(
  apiKey: string,
  model: string,
  messages: unknown[],
): Promise<{ ok: true; content: string } | { ok: false; message: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/nmacy/coffee_tracker",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: ctrl.signal,
    });
  } catch {
    return { ok: false, message: "The AI request timed out or failed." };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    return {
      ok: false,
      message: `OpenRouter returned ${res.status}. Check the API key or your credits.`,
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "The AI returned an unreadable response." };
  }
  const choices =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>).choices : null;
  const first = Array.isArray(choices) && typeof choices[0] === "object" && choices[0] !== null
    ? (choices[0] as Record<string, unknown>)
    : null;
  const message = first?.message;
  const content = typeof message === "object" && message !== null
    ? (message as Record<string, unknown>).content
    : null;
  if (typeof content !== "string") {
    return { ok: false, message: "The AI returned an empty response." };
  }
  return { ok: true, content };
}

/** Pull structured coffee fields out of a chat-completion reply, or an error message. */
function parseFieldsReply<T>(
  content: string,
  parse: (data: unknown) => T,
): { ok: true; fields: T } | { ok: false; message: string } {
  const parsed = extractJson(content);
  if (parsed === null) {
    const preview = content.replace(/\s+/g, " ").slice(0, 160);
    return {
      ok: false,
      message: `The AI did not return usable JSON. Start of reply: "${preview}"`,
    };
  }
  return { ok: true, fields: parse(parsed) };
}

export async function enrichCoffeePage(url: string, apiKey: string, modelOverride?: string): Promise<EnrichResult> {
  if (!apiKey) {
    return { ok: false, message: "OpenRouter API key is not configured." };
  }
  const model = modelOverride || DEFAULT_MODEL;

  const text = await fetchPageText(url);
  if (!text) return { ok: false, message: "Could not read that store page." };

  const reply = await callOpenRouterChat(apiKey, model, [
    {
      role: "system",
      content:
        "You extract facts about a bag of coffee from a store product page. " +
        "Return ONLY a JSON object with these keys: country, region, variety, " +
        "producer (grower or farm), elevation (numbers only, meters above sea " +
        "level — convert feet if printed, e.g. \"1,900–2,100\"), process, " +
        "roastLevel (one of: light, medium-light, medium, medium-dark, dark), " +
        "agtron (the Agtron roast color number if listed, e.g. \"63\"), " +
        "mix (blend or single-origin), decaffeinated (boolean), tastingNotes " +
        "(flavor notes: one short sentence describing the taste, e.g. \"sweet citrus, " +
        "jasmine and a syrupy body\"; null when the page has none), description. " +
        "Also, if the page (e.g. a footer, about section, or brand story) says " +
        "anything about the ROASTER itself (the company, not this specific bag), " +
        "include: roasterState (state/province they operate out of), " +
        "roasterCountry, roasterDescription (a short blurb about the roaster), " +
        "roasterFoundedYear (a 4-digit year), roasterSpecialty (a short phrase " +
        "on what they focus on, e.g. \"single-origin light roasts\"). " +
        "Use null for anything the page does not say — do not guess. If the page " +
        "mentions bag size options, ignore them.",
    },
    { role: "user", content: `Store page URL: ${url}\n\nPage text:\n${text}` },
  ]);
  if (!reply.ok) return reply;

  const result = parseFieldsReply(reply.content, parseFields);
  if (!result.ok) return result;
  const roasterResult = parseFieldsReply(reply.content, parseRoasterFields);

  const fields = result.fields;
  // Deterministic fallbacks straight from the page text.
  if (!fields.elevation) fields.elevation = normalizeElevation(findElevation(text) ?? "");
  if (!fields.tastingNotes) fields.tastingNotes = findTastingNotes(text);
  if (!fields.roastLevel) {
    const agtron = findAgtron(text);
    if (agtron !== null) fields.roastLevel = agtronToRoast(agtron);
  }
  return {
    ok: true,
    fields,
    roaster: roasterResult.ok
      ? roasterResult.fields
      : { state: null, country: null, description: null, foundedYear: null, specialty: null },
  };
}

/** Coffee facts read straight off a bag's label in a photo — plus a roaster/name guess. */
export type PhotoFields = AiCoffeeFields & { roaster: string | null; name: string | null };

export type PhotoAnalysisResult =
  | { ok: true; fields: PhotoFields }
  | { ok: false; message: string };

function parsePhotoFields(data: unknown): PhotoFields {
  const rec = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  return {
    ...parseFields(data),
    roaster: cleanString(rec.roaster),
    name: cleanString(rec.name),
  };
}

/** Read a coffee bag's label from a photo (data URL) and extract the same facts as a store page. */
export async function analyzeCoffeePhoto(
  photoDataUrl: string,
  apiKey: string,
  modelOverride?: string,
): Promise<PhotoAnalysisResult> {
  if (!apiKey) {
    return { ok: false, message: "OpenRouter API key is not configured." };
  }
  if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(photoDataUrl)) {
    return { ok: false, message: "Not a readable image." };
  }
  const model = modelOverride || DEFAULT_MODEL;

  const reply = await callOpenRouterChat(apiKey, model, [
    {
      role: "system",
      content:
        "You read the label on a photo of a bag of coffee and extract facts about it. " +
        "Return ONLY a JSON object with these keys: roaster (the company that roasted " +
        "it), name (the coffee's product/origin name as printed on the bag), country, " +
        "region, variety, producer (grower or farm), elevation (numbers only, meters " +
        "above sea level — convert feet if printed, e.g. \"1,900–2,100\"), process, " +
        "roastLevel (one of: light, medium-light, medium, medium-dark, dark), " +
        "agtron (the Agtron roast color number if printed, e.g. \"63\"), " +
        "mix (blend or single-origin), decaffeinated (boolean), tastingNotes (flavor " +
        "notes printed on the bag, one short phrase), description. Use null for " +
        "anything not visible or legible in the photo — do not guess.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Extract the coffee facts from this bag's label." },
        { type: "image_url", image_url: { url: photoDataUrl } },
      ],
    },
  ]);
  if (!reply.ok) return reply;

  return parseFieldsReply(reply.content, parsePhotoFields);
}

export type RoasterEnrichResult =
  | { ok: true; fields: AiRoasterFields & { logoCandidates: string[] } }
  | { ok: false; message: string };

/** Read a roaster's own homepage/about page and extract profile facts. */
export async function enrichRoasterPage(url: string, apiKey: string, modelOverride?: string): Promise<RoasterEnrichResult> {
  if (!apiKey) {
    return { ok: false, message: "OpenRouter API key is not configured." };
  }
  const model = modelOverride || DEFAULT_MODEL;

  const [text, meta] = await Promise.all([fetchPageText(url), fetchPageMeta(url)]);
  if (!text) return { ok: false, message: "Could not read that page." };

  const reply = await callOpenRouterChat(apiKey, model, [
    {
      role: "system",
      content:
        "You extract facts about a COFFEE ROASTER company from its own website " +
        "page. Return ONLY a JSON object with these keys: roasterState " +
        "(state/province they operate out of), roasterCountry, " +
        "roasterDescription (a short blurb about who they are), " +
        "roasterFoundedYear (a 4-digit year), roasterSpecialty (a short phrase " +
        "on what they focus on, e.g. \"single-origin light roasts\"). Use null " +
        "for anything the page does not say — do not guess.",
    },
    { role: "user", content: `Roaster page URL: ${url}\n\nPage text:\n${text}` },
  ]);
  if (!reply.ok) return reply;

  const result = parseFieldsReply(reply.content, parseRoasterFields);
  if (!result.ok) return result;
  const logoCandidates = [...meta.icons, meta.image].filter((u): u is string => u !== null);
  return { ok: true, fields: { ...result.fields, logoCandidates } };
}

/** Merge photo- and product-page-derived fields, preferring the (usually fuller) page facts. */
export function mergePhotoAndPageFields(photo: PhotoFields, page: AiCoffeeFields): PhotoFields {
  return {
    roaster: photo.roaster,
    name: photo.name,
    country: page.country ?? photo.country,
    region: page.region ?? photo.region,
    variety: page.variety ?? photo.variety,
    producer: page.producer ?? photo.producer,
    elevation: page.elevation ?? photo.elevation,
    process: page.process ?? photo.process,
    roastLevel: page.roastLevel ?? photo.roastLevel,
    mix: page.mix ?? photo.mix,
    decaffeinated: page.decaffeinated || photo.decaffeinated,
    tastingNotes: page.tastingNotes ?? photo.tastingNotes,
    description: page.description ?? photo.description,
  };
}