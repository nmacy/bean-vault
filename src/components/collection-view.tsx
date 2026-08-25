"use client";

import { useMemo } from "react";
import Link from "next/link";
import GridEditor from "@/components/grid-editor";
import CoffeeFilterBar from "@/components/coffee-filter-bar";
import { formatCents, photoUrl } from "@/lib/format";
import { cap } from "@/lib/cap";
import {
  emptyFilters,
  filterCoffees,
  sortCoffees,
  yearOf,
  parseFilters,
  parseSort,
  FILTERS_KEY,
  SORT_KEY,
  type SortSpec,
} from "@/lib/coffee-filters";
import { useLocalStorageState } from "@/lib/use-local-storage-state";

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
  openedAt: string | null;
  frozenAt: string | null;
  unfrozenAt: string | null;
  emptiedAt: string | null;
  priceCents: number | null;
  weightGrams: number | null;
  rating: number | null;
  decaffeinated: boolean;
  aiEnriched: boolean;
  photoFile: string | null;
};

const STATUS_KEY = "bean-vault:coffees-status";
const VALID_STATUSES = ["available", "opened", "resting", "frozen", "empty", "all"];

function parseView(raw: string): "tiles" | "grid" | null {
  return raw === "tiles" || raw === "grid" ? raw : null;
}
function parseStatus(raw: string): string | null {
  return VALID_STATUSES.includes(raw) ? raw : null;
}

export default function CollectionView({ beans }: { beans: BeanItem[] }) {
  // Each of these is backed by localStorage via useLocalStorageState, which
  // is hydration-safe: the server (and first client render) always sees the
  // default, and the persisted value — if any — is picked up on the next
  // render through useSyncExternalStore. Reading localStorage directly in a
  // useState initializer (or restoring it via a mount effect) runs during
  // hydration too and, the moment a stored value differs from the default,
  // mismatches the server-rendered markup and trips a hydration error.
  const [view, setView] = useLocalStorageState<"tiles" | "grid">(VIEW_KEY, "tiles", parseView, (v) => v);
  const [status, setStatus] = useLocalStorageState<string>(STATUS_KEY, "all", parseStatus, (v) => v);
  const [filters, setFilters] = useLocalStorageState(FILTERS_KEY, emptyFilters(), parseFilters);
  const [sort, setSort] = useLocalStorageState<SortSpec>(SORT_KEY, null, parseSort);

  const byStatus = useMemo(() => {
    if (status === "all") return beans;
    if (status === "available") return beans.filter((b) => b.status !== "empty");
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
        {(["available", "opened", "resting", "frozen", "empty", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip${status === s ? " active" : ""}`}
            onClick={() => setStatus(s)}
          >
            {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)} (
            {s === "all"
              ? beans.length
              : s === "available"
                ? beans.filter((b) => b.status !== "empty").length
                : beans.filter((b) => b.status === s).length}
            )
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