"use client";

import { useMemo, useState, type ReactNode } from "react";
import { formatCents } from "@/lib/format";

type Row = {
  id: number;
  roaster: string;
  origin: string | null;
  process: string | null;
  roastLevel: string | null;
  roastDate: string | null;
  purchaseDate: string | null;
  createdAt: string;
  priceCents: number | null;
  weightGrams: number | null;
  rating: number | null;
  decaffeinated: boolean;
};

const PRESETS = [
  { id: "3m", label: "Last 3 months" },
  { id: "6m", label: "Last 6 months" },
  { id: "12m", label: "Last 12 months" },
  { id: "ty", label: "This year" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom…" },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** The date that places a bag on the timeline: roast date, else purchase, else added. */
function bagDate(r: Row): string {
  return r.roastDate ?? r.purchaseDate ?? r.createdAt;
}

function countBy<K>(items: K[]): Map<K, number> {
  const m = new Map<K, number>();
  for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

/** "2025-06" → "Jun 2025"; year keys pass through as "2025". */
function periodLabel(key: string): string {
  if (key.length !== 7) return key;
  const d = new Date(`${key}-01T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export default function Dashboard({ rows }: { rows: Row[] }) {
  const [preset, setPreset] = useState<PresetId>("12m");
  const [custom, setCustom] = useState({ from: "", to: "" });

  const range = useMemo(() => {
    const to = today();
    if (preset === "all") return { from: null, to };
    if (preset === "custom") {
      return { from: custom.from || null, to: custom.to || to };
    }
    if (preset === "ty") return { from: `${to.slice(0, 4)}-01-01`, to };
    const months = { "3m": 3, "6m": 6, "12m": 12 }[preset];
    return { from: addMonths(to, months ? -months : 0), to };
  }, [preset, custom]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const d = bagDate(r);
        if (range.from && d < range.from) return false;
        if (d > range.to) return false;
        return true;
      }),
    [rows, range],
  );

  const stats = useMemo(() => {
    const prices = filtered.map((r) => r.priceCents).filter((p): p is number => p !== null);
    const weights = filtered.map((r) => r.weightGrams).filter((w): w is number => w !== null);
    const ratings = filtered.map((r) => r.rating).filter((r): r is number => r !== null);
    return {
      bags: filtered.length,
      spend: prices.reduce((a, b) => a + b, 0),
      avgPrice: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      medianPrice: median(prices),
      totalWeight: weights.reduce((a, b) => a + b, 0),
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      rated: ratings.length,
      decaf: filtered.filter((r) => r.decaffeinated).length,
    };
  }, [filtered]);

  /* monthly (or yearly, for long ranges) count + spend buckets */
  const timeline = useMemo(() => {
    const spanYears =
      range.from && range.to
        ? Number(range.to.slice(0, 4)) - Number(range.from.slice(0, 4)) + (range.from.slice(5, 7) !== range.to.slice(5, 7) ? 1 : 0)
        : 5;
    const granularity = spanYears > 2 ? "year" : "month";
    const buckets = new Map<string, { key: string; count: number; spend: number }>();
    for (const r of filtered) {
      const d = bagDate(r);
      const key = granularity === "year" ? d.slice(0, 4) : d.slice(0, 7);
      const b = buckets.get(key) ?? { key, count: 0, spend: 0 };
      b.count += 1;
      if (r.priceCents != null) b.spend += r.priceCents;
      buckets.set(key, b);
    }
    return [...buckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => ({ label: b.key, count: b.count, spend: b.spend }));
  }, [filtered, range]);

  const roastDist = useMemo(() => {
    const levels = ["light", "medium-light", "medium", "medium-dark", "dark"];
    const counts = countBy(filtered.map((r) => r.roastLevel ?? ""));
    return levels
      .map((l) => ({ label: l, value: counts.get(l) ?? 0 }))
      .filter((x) => x.value > 0)
      .concat(counts.get("") ?? 0 > 0 ? [{ label: "Unspecified", value: counts.get("") ?? 0 }] : []);
  }, [filtered]);

  function categoryCounts(rows: Row[], get: (r: Row) => string | null, top: number) {
    const counts = countBy(rows.map(get).filter((v): v is string => v !== null && v !== ""));
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const head = sorted.slice(0, top);
    const rest = sorted.slice(top).reduce((n, [, c]) => n + c, 0);
    if (rest > 0) head.push(["Other", rest] as [string, number]);
    return head.map(([label, value]) => ({ label, value }));
  }

  const roasterDist = useMemo(() => categoryCounts(filtered, (r) => r.roaster, 8), [filtered]);
  const originDist = useMemo(
    () => categoryCounts(filtered, (r) => (r.origin ? r.origin.split(",")[0].trim() : null), 8),
    [filtered],
  );
  const processDist = useMemo(() => categoryCounts(filtered, (r) => r.process, 6), [filtered]);
  const ratingDist = useMemo(() => {
    const counts = countBy(filtered.filter((r) => r.rating != null).map((r) => r.rating as number));
    return [1, 2, 3, 4, 5].map((n) => ({ label: "★".repeat(n), value: counts.get(n) ?? 0 })).filter((x) => x.value > 0);
  }, [filtered]);

  const maxRoaster = Math.max(1, ...roasterDist.map((x) => x.value));
  const maxOrigin = Math.max(1, ...originDist.map((x) => x.value));
  const maxProcess = Math.max(1, ...processDist.map((x) => x.value));
  const maxRating = Math.max(1, ...ratingDist.map((x) => x.value));

  return (
    <div className="dashboard">
      <div className="dash-controls">
        <select
          className="filter-select"
          value={preset}
          onChange={(e) => setPreset(e.target.value as PresetId)}
          aria-label="Time period"
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {preset === "custom" ? (
          <>
            <input
              type="date"
              className="filter-select dash-date"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              aria-label="From date"
            />
            <span className="dash-to">to</span>
            <input
              type="date"
              className="filter-select dash-date"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              aria-label="To date"
            />
          </>
        ) : null}
        <span className="grid-hint">
          {filtered.length} of {rows.length} bags
          {range.from ? ` · since ${range.from}` : ""}
          {range.to ? ` · through ${range.to}` : ""}
          <br />
          Timeline uses roast date (purchase date when set, added date as a last resort).
        </span>
      </div>

      <div className="dash-stats">
        <Stat label="Bags" value={String(stats.bags)} />
        <Stat label="Total spend" value={formatCents(stats.spend)} />
        <Stat label="Avg price / bag" value={stats.avgPrice != null ? formatCents(Math.round(stats.avgPrice)) : "—"} sub={stats.medianPrice != null ? `median ${formatCents(stats.medianPrice)}` : undefined} />
        <Stat label="Weight bought" value={stats.totalWeight >= 1000 ? `${(stats.totalWeight / 1000).toFixed(1)} kg` : `${stats.totalWeight} g`} />
        <Stat label="Avg rating" value={stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"} sub={stats.rated ? `${stats.rated} rated` : undefined} />
        <Stat label="Decaf" value={`${stats.decaf} of ${stats.bags}`} />
      </div>

      <div className="dash-grid">
        <Card title="Bags per period" subtitle={timeline.length ? `${periodLabel(timeline[0].label)} — ${periodLabel(timeline[timeline.length - 1].label)}` : undefined}>
          <HBars data={timeline.map((b) => ({ label: periodLabel(b.label), value: b.count }))} max={Math.max(1, ...timeline.map((b) => b.count))} />
        </Card>

        <Card title="Spend per period" subtitle="Total price of bags in each period">
          <HBars data={timeline.map((b) => ({ label: periodLabel(b.label), value: b.spend }))} max={Math.max(1, ...timeline.map((b) => b.spend))} valueFmt={(v) => formatCents(v)} />
        </Card>

        <Card title="Roasters" subtitle="Bags per roaster">
          <HBars data={roasterDist.map((x) => ({ label: x.label, value: x.value }))} max={maxRoaster} />
        </Card>

        <Card title="Origins" subtitle="First country/region of origin">
          <HBars data={originDist.map((x) => ({ label: x.label, value: x.value }))} max={maxOrigin} />
        </Card>

        <Card title="Roast levels">
          <HBars data={roastDist.map((x) => ({ label: x.label, value: x.value }))} max={Math.max(1, ...roastDist.map((x) => x.value))} />
        </Card>

        <Card title="Process" subtitle="Processing methods">
          <HBars data={processDist.map((x) => ({ label: x.label, value: x.value }))} max={maxProcess} />
        </Card>

        <Card title="Ratings">
          {ratingDist.length === 0 ? (
            <p className="dash-empty">No ratings recorded yet.</p>
          ) : (
            <div className="rating-bars">
              {ratingDist.map((x) => (
                <div key={x.label} className="rating-row">
                  <span className="rating-stars">{x.label}</span>
                  <div className="rating-track">
                    <div className="rating-fill" style={{ width: `${(x.value / maxRating) * 100}%` }} />
                  </div>
                  <span className="rating-count">{x.value}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Decaf vs regular">
          <Donut total={stats.bags} decaf={stats.decaf} />
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat-label">{label}</div>
      <div className="dash-stat-value">{value}</div>
      {sub ? <div className="dash-stat-sub">{sub}</div> : null}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="dash-card">
      <h3 className="dash-card-title">{title}</h3>
      {subtitle ? <p className="dash-card-sub">{subtitle}</p> : null}
      <div className="dash-card-body">{children}</div>
    </section>
  );
}

function HBars({
  data,
  max,
  valueFmt = (v) => String(v),
}: {
  data: { label: string; value: number }[];
  max: number;
  valueFmt?: (v: number) => string;
}) {
  if (data.length === 0) return <p className="dash-empty">Nothing in this period.</p>;
  return (
    <div className="hbars">
      {data.map((d) => (
        <div key={d.label} className="hbar-row">
          <span className="hbar-label" title={d.label}>{d.label}</span>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%` }} title={`${d.label}: ${valueFmt(d.value)}`} />
          </div>
          <span className="hbar-value">{valueFmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ total, decaf }: { total: number; decaf: number }) {
  const pct = total > 0 ? (decaf / total) * 100 : 0;
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 96 96" className="donut" role="img" aria-label={`${decaf} of ${total} bags decaffeinated`}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--row-border)" strokeWidth="12" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="12"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`}
          transform="rotate(-90 48 48)"
        />
        <text x="48" y="50" textAnchor="middle" className="donut-label" dominantBaseline="middle">
          {Math.round(pct)}%
        </text>
      </svg>
      <div className="donut-legend">
        <span><i className="dot" style={{ background: "var(--accent)" }} />Decaf — {decaf}</span>
        <span><i className="dot" style={{ background: "var(--row-border)" }} />Regular — {total - decaf}</span>
      </div>
    </div>
  );
}