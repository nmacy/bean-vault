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

function htmlToText(html: string): string {
  return html
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
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_CHARS);
}

async function fetchPageText(url: string): Promise<string | null> {
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

/** Pull the first JSON object out of a model reply (tolerates code fences/prose). */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* fall through */
    }
  }
  try {
    return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
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
    elevation: cleanString(rec.elevation),
    process: cleanString(rec.process),
    roastLevel,
    mix,
    decaffeinated: decaf,
    tastingNotes: cleanString(rec.tastingNotes ?? rec.tasting_notes),
    description: cleanString(rec.description),
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
  | { ok: true; fields: AiCoffeeFields }
  | { ok: false; message: string };

export async function enrichCoffeePage(url: string, apiKey: string, modelOverride?: string): Promise<EnrichResult> {
  if (!apiKey) {
    return { ok: false, message: "OpenRouter API key is not configured." };
  }
  const model = modelOverride || DEFAULT_MODEL;

  const text = await fetchPageText(url);
  if (!text) return { ok: false, message: "Could not read that store page." };

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
        model: model,
        temperature: 0,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You extract facts about a bag of coffee from a store product page. " +
              "Return ONLY a JSON object with these keys: country, region, variety, " +
              "producer (grower or farm), elevation (in meters/masl), process, " +
              "roastLevel (one of: light, medium-light, medium, medium-dark, dark), " +
              "mix (blend or single-origin), decaffeinated (boolean), tastingNotes, " +
              "description. Use null when the page does not say. If the page " +
              "mentions bag size options, ignore them.",
          },
          { role: "user", content: `Store page URL: ${url}\n\nPage text:\n${text}` },
        ],
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
  const parsed = extractJson(content);
  if (parsed === null) {
    return { ok: false, message: "The AI did not return usable JSON." };
  }
  return { ok: true, fields: parseFields(parsed) };
}