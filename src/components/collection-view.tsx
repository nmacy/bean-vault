"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GridEditor from "@/components/grid-editor";
import CoffeeFilterBar from "@/components/coffee-filter-bar";
import { formatCents, photoUrl } from "@/lib/format";
import { cap } from "@/lib/cap";
import {
  filterCoffees,
  sortCoffees,
  yearOf,
  readStoredFilters,
  writeStoredFilters,
  readStoredSort,
  writeStoredSort,
  type CoffeeFilters,
  type SortSpec,
} from "@/lib/coffee-filters";

const VIEW_KEY = "bean-vault:coffees-view";

export type BeanItem = {
  id: number;
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
  priceCents: number | null;
  weightGrams: number | null;
  rating: number | null;
  decaffeinated: boolean;
  aiEnriched: boolean;
  photoFile: string | null;
};

const STATUS_KEY = "bean-vault:coffees-status";
function readView(): "tiles" | "grid" {
  if (typeof window === "undefined") return "tiles";
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    if (v === "grid" || v === "tiles") return v;
  } catch {
    /* ignore */
  }
  return "tiles";
}
function readStatus(): string {
  if (typeof window === "undefined") return "all";
  try {
    const v = window.localStorage.getItem(STATUS_KEY);
    if (["all", "resting", "frozen", "opened", "empty"].includes(v ?? "")) return v as string;
  } catch {
    /* ignore */
  }
  return "all";
}

export default function CollectionView({ beans }: { beans: BeanItem[] }) {
  const [view, setView] = useState<"tiles" | "grid">(readView);
  const [status, setStatus] = useState<string>(readStatus);
  const [filters, setFilters] = useState<CoffeeFilters>(readStoredFilters);
  const [sort, setSort] = useState<SortSpec>(readStoredSort);

  const byStatus = useMemo(() => {
    if (status === "all") return beans;
    return beans.filter((b) => b.status === status);
  }, [beans, status]);

  const filtered = useMemo(
    () => sortCoffees(filterCoffees(byStatus, filters), sort),
    [byStatus, filters, sort],
  );

  const roasters = useMemo(
    () => [...new Set(byStatus.map((b) => b.roaster))].sort((a, b) => a.localeCompare(b)),
    [byStatus],
  );
  const years = useMemo(
    () => [...new Set(byStatus.map(yearOf).filter((y): y is string => y !== null))].sort().reverse(),
    [byStatus],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);
  useEffect(() => {
    try {
      window.localStorage.setItem(STATUS_KEY, status);
    } catch {
      /* ignore */
    }
  }, [status]);
  useEffect(() => writeStoredFilters(filters), [filters]);
  useEffect(() => writeStoredSort(sort), [sort]);

  return (
    <>
      <div className="coffee-head">
        <h1>My coffees ({filtered.length})</h1>
        <div className="coffee-head-actions">
          <div className="view-switch" role="group" aria-label="Collection view">
            <button
              type="button"
              className={`view-switch-btn${view === "tiles" ? " active" : ""}`}
              onClick={() => setView("tiles")}
              aria-label="Tiles view"
              title="Tiles view"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
              </svg>
            </button>
            <button
              type="button"
              className={`view-switch-btn${view === "grid" ? " active" : ""}`}
              onClick={() => setView("grid")}
              aria-label="Grid view"
              title="Grid view"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="4" rx="1.5" />
                <rect x="3" y="10" width="18" height="4" rx="1.5" />
                <rect x="3" y="17" width="18" height="4" rx="1.5" />
              </svg>
            </button>
          </div>
          <Link href="/new" className="btn">Add coffee</Link>
        </div>
      </div>

      <div className="status-filter" role="group" aria-label="Filter by status">
        {(["all", "resting", "frozen", "opened", "empty"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip${status === s ? " active" : ""}`}
            onClick={() => setStatus(s)}
          >
            {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)} (
            {s === "all" ? beans.length : beans.filter((b) => b.status === s).length})
          </button>
        ))}
      </div>

      <CoffeeFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        roasters={roasters}
        years={years}
        resultCount={filtered.length}
        totalCount={byStatus.length}
      />

      {view === "tiles" ? <Tiles beans={filtered} /> : <GridEditor beans={filtered} sort={sort} onSortChange={setSort} />}
    </>
  );
}

function Tiles({ beans }: { beans: BeanItem[] }) {
  if (beans.length === 0) {
    return (
      <div className="empty">
        <h2>No coffee yet</h2>
        <p>Add the first bag you have bought.</p>
        <Link href="/new" className="btn">Add coffee</Link>
      </div>
    );
  }
  return (
    <div className="grid">
      {beans.map((c) => {
        const src = photoUrl(c.photoFile);
        return (
          <Link key={c.id} href={`/coffees/${c.id}`} className="card">
            <div className="card-photo">
              {src ? (
                <img src={src} alt={`${c.roaster} ${c.name}`} loading="lazy" />
              ) : (
                <div className="placeholder">coffee</div>
              )}
            </div>
            <div className="card-body">
              <h3>{c.name}</h3>
              <div className="roaster">{c.roaster}</div>
              <div className="tags">
                {c.decaffeinated ? <span className="tag">Decaf</span> : null}
                {c.mix === "blend" ? <span className="tag">Blend</span> : c.mix === "single-origin" ? <span className="tag">Single origin</span> : null}
                {c.country ? <span className="tag">{c.country}{c.region ? ` - ${c.region}` : ""}</span> : null}
                {c.roastLevel ? <span className="tag">{cap(c.roastLevel)}</span> : null}
                {c.process ? <span className="tag">{c.process}</span> : null}
              </div>
              <div className="meta">
                <span>
                  {c.priceCents != null ? formatCents(c.priceCents) : ""}
                  {c.weightGrams != null ? ` · ${c.weightGrams} g` : ""}
                </span>
                {c.rating != null ? (
                  <span className="stars">{"★".repeat(c.rating)}</span>
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}