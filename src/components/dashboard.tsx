"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatCents } from "@/lib/format";

type Row = {
  id: number;
  name: string;
  roaster: string;
  country: string | null;
  process: string | null;
  roastLevel: string | null;
  roastDate: string | null;
  purchaseDate: string | null;
  createdAt: string;
  priceCents: number | null;
  weightGrams: number | null;
  rating: number | null;
  decaffeinated: boolean;
  photoFile: string | null;
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

type Segment = { label: string; value: number; rows: Row[] };

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

/** Category counts (top N + "Other") with the underlying rows per segment. */
function categorySegments(rows: Row[], get: (r: Row) => string | null, top: number): Segment[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = get(r);
    if (k === null || k === "") continue;
    const g = groups.get(k) ?? [];
    g.push(r);
    groups.set(k, g);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const head = sorted.slice(0, top);
  const rest = sorted.slice(top).flatMap(([, g]) => g);
  const out: Segment[] = head.map(([label, g]) => ({ label, value: g.length, rows: g }));
  if (rest.length > 0) out.push({ label: "Other", value: rest.length, rows: rest });
  return out;
}

export default function Dashboard({ rows }: { rows: Row[] }) {
  const [preset, setPreset] = useState<PresetId>("12m");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [drill, setDrill] = useState<{ title: string; sub?: string; rows: Row[] } | null>(null);

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

  const rangeLabel = useMemo(
    () => (range.from ? `${range.from} to ${range.to}` : "All time"),
    [range],
  );

  function selectSegment(title: string, segmentRows: Row[]) {
    setDrill({ title, sub: rangeLabel, rows: segmentRows });
  }

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

  /* monthly (or yearly, for long ranges) count + spend buckets with rows */
  const timeline = useMemo(() => {
    const spanYears =
      range.from && range.to
        ? Number(range.to.slice(0, 4)) - Number(range.from.slice(0, 4)) + (range.from.slice(5, 7) !== range.to.slice(5, 7) ? 1 : 0)
        : 5;
    const granularity = spanYears > 2 ? "year" : "month";
    const buckets = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = bagDate(r).slice(0, granularity === "year" ? 4 : 7);
      const g = buckets.get(key) ?? [];
      g.push(r);
      buckets.set(key, g);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, g]) => ({
        label: periodLabel(key),
        value: g.length,
        spend: g.reduce((n, r) => n + (r.priceCents ?? 0), 0),
        rows: g,
      }))
      .map(({ spend, ...rest }) => ({ ...rest, spend }));
  }, [filtered, range]);

  const roastSegments = useMemo(() => {
    const levels = ["light", "medium-light", "medium", "medium-dark", "dark"];
    const out: Segment[] = [];
    for (const l of levels) {
      const g = filtered.filter((r) => r.roastLevel === l);
      if (g.length > 0) out.push({ label: l, value: g.length, rows: g });
    }
    const unspecified = filtered.filter((r) => !r.roastLevel);
    if (unspecified.length > 0) out.push({ label: "Unspecified", value: unspecified.length, rows: unspecified });
    return out;
  }, [filtered]);

  const roasterSegments = useMemo(() => categorySegments(filtered, (r) => r.roaster, 8), [filtered]);
  const countrySegments = useMemo(
    () => categorySegments(filtered, (r) => r.country, 8),
    [filtered],
  );
  const processSegments = useMemo(() => categorySegments(filtered, (r) => r.process, 6), [filtered]);

  const ratingSegments = useMemo(() => {
    const counts = countBy(filtered.filter((r) => r.rating != null).map((r) => r.rating as number));
    return [1, 2, 3, 4, 5]
      .map((n) => ({ label: "★".repeat(n), value: counts.get(n) ?? 0, rows: filtered.filter((r) => r.rating === n) }))
      .filter((s) => s.value > 0);
  }, [filtered]);

  const decafRows = useMemo(() => filtered.filter((r) => r.decaffeinated), [filtered]);
  const regularRows = useMemo(() => filtered.filter((r) => !r.decaffeinated), [filtered]);

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
          Timeline uses roast date (purchase date when set, added date as a last resort). Click any bar or row to see its bags.
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
        <Card title="Bags per period" subtitle={timeline.length ? `${timeline[0].label} — ${timeline[timeline.length - 1].label}` : undefined}>
          <HBars data={timeline.map(({ rows: tRows, ...s }) => ({ ...s, rows: tRows }))} onSelect={selectSegment} max={Math.max(1, ...timeline.map((b) => b.value))} />
        </Card>

        <Card title="Spend per period" subtitle="Total price of bags in each period">
          <HBars
            data={timeline.map(({ rows: tRows, label, value }) => ({ label, value, rows: tRows }))}
            onSelect={selectSegment}
            max={Math.max(1, ...timeline.map((b) => b.spend))}
            valueFmt={(v) => formatCents(v)}
          />
        </Card>

        <Card title="Roasters" subtitle="Bags per roaster">
          <HBars data={roasterSegments} onSelect={selectSegment} max={Math.max(1, ...roasterSegments.map((x) => x.value))} />
        </Card>

        <Card title="Countries" subtitle="Country of origin">
          <HBars data={countrySegments} onSelect={selectSegment} max={Math.max(1, ...countrySegments.map((x) => x.value))} />
        </Card>

        <Card title="Roast levels">
          <HBars data={roastSegments} onSelect={selectSegment} max={Math.max(1, ...roastSegments.map((x) => x.value))} />
        </Card>

        <Card title="Process" subtitle="Processing methods">
          <HBars data={processSegments} onSelect={selectSegment} max={Math.max(1, ...processSegments.map((x) => x.value))} />
        </Card>

        <Card title="Ratings">
          {ratingSegments.length === 0 ? (
            <p className="dash-empty">No ratings recorded yet.</p>
          ) : (
            <div className="rating-bars">
              {ratingSegments.map((x) => (
                <button
                  key={x.label}
                  type="button"
                  className="rating-row clickable"
                  onClick={() => selectSegment(`Rated ${x.label}`, x.rows)}
                >
                  <span className="rating-stars">{x.label}</span>
                  <span className="rating-track">
                    <span className="rating-fill" style={{ width: `${(x.value / Math.max(1, ...ratingSegments.map((s) => s.value))) * 100}%` }} />
                  </span>
                  <span className="rating-count">{x.value}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Decaf vs regular">
          <Donut
            total={stats.bags}
            decaf={decafRows.length}
            regular={regularRows.length}
            onDecaf={() => selectSegment("Decaf", decafRows)}
            onRegular={() => selectSegment("Regular", regularRows)}
          />
        </Card>
      </div>

      {drill ? (
        <Drill
          title={drill.title}
          sub={drill.sub}
          rows={drill.rows}
          onClose={() => setDrill(null)}
        />
      ) : null}
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
  onSelect,
  valueFmt = (v) => String(v),
}: {
  data: Segment[];
  max: number;
  onSelect: (title: string, rows: Row[]) => void;
  valueFmt?: (v: number) => string;
}) {
  if (data.length === 0) return <p className="dash-empty">Nothing in this period.</p>;
  return (
    <div className="hbars">
      {data.map((d) => (
        <button
          key={d.label}
          type="button"
          className="hbar-row clickable"
          onClick={() => onSelect(d.label, d.rows)}
          title={`${d.label}: ${valueFmt(d.value)} — click for the bags`}
        >
          <span className="hbar-label">{d.label}</span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="hbar-value">{valueFmt(d.value)}</span>
        </button>
      ))}
    </div>
  );
}

function Donut({
  total,
  decaf,
  regular,
  onDecaf,
  onRegular,
}: {
  total: number;
  decaf: number;
  regular: number;
  onDecaf: () => void;
  onRegular: () => void;
}) {
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
        <button type="button" className="legend-row clickable" onClick={onDecaf}>
          <i className="dot" style={{ background: "var(--accent)" }} />
          Decaf — {decaf}
        </button>
        <button type="button" className="legend-row clickable" onClick={onRegular}>
          <i className="dot" style={{ background: "var(--row-border)" }} />
          Regular — {regular}
        </button>
      </div>
    </div>
  );
}

function Drill({
  title,
  sub,
  rows,
  onClose,
}: {
  title: string;
  sub?: string;
  rows: Row[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="drill-overlay" onClick={onClose}>
      <div className="drill-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="drill-head">
          <div>
            <h3 className="drill-title">{title}</h3>
            {sub ? <p className="drill-sub">
              {rows.length} bag{rows.length === 1 ? "" : "s"} · {sub}
            </p> : null}
          </div>
          <button type="button" className="btn btn-small btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drill-list">
          {rows.map((r) => (
            <Link key={r.id} href={`/coffees/${r.id}`} className="drill-item">
              {r.photoFile ? (
                <img src={`/api/photos/${r.photoFile}`} alt="" className="drill-thumb" />
              ) : (
                <span className="drill-thumb drill-thumb-empty" />
              )}
              <span className="drill-name">
                {r.name}
                <span className="drill-sub-line">{r.roaster}</span>
              </span>
              <span className="drill-meta">
                <span>{bagDate(r)}</span>
                <span>{r.priceCents != null ? formatCents(r.priceCents) : ""}{r.weightGrams ? ` · ${r.weightGrams} g` : ""}</span>
                {r.rating != null ? <span className="stars">{"★".repeat(r.rating)}</span> : null}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}