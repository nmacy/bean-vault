"use client";

import type { ReactNode } from "react";
import {
  ROAST_LEVELS,
  hasActiveFilters,
  emptyFilters,
  type CoffeeFilters,
  type SortKey,
  type SortSpec,
} from "@/lib/coffee-filters";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "roaster", label: "Roaster" },
  { key: "name", label: "Name" },
  { key: "country", label: "Country" },
  { key: "region", label: "Region" },
  { key: "variety", label: "Variety" },
  { key: "producer", label: "Producer" },
  { key: "elevation", label: "Elevation" },
  { key: "process", label: "Process" },
  { key: "mix", label: "Type" },
  { key: "roastLevel", label: "Roast" },
  { key: "roastDate", label: "Roast date" },
  { key: "purchaseDate", label: "Purchased" },
  { key: "status", label: "Status" },
  { key: "openedAt", label: "Opened date" },
  { key: "frozenAt", label: "Frozen date" },
  { key: "unfrozenAt", label: "Unfrozen date" },
  { key: "emptiedAt", label: "Emptied date" },
  { key: "frozenDays", label: "Frozen days" },
  { key: "price", label: "Price" },
  { key: "weight", label: "Weight" },
  { key: "rating", label: "Rating" },
  { key: "decaf", label: "Decaf" },
];

export default function CoffeeFilterBar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  roasters,
  years,
  resultCount,
  totalCount,
  right,
}: {
  filters: CoffeeFilters;
  onFiltersChange: (f: CoffeeFilters) => void;
  sort: SortSpec;
  onSortChange: (s: SortSpec) => void;
  roasters: string[];
  years: string[];
  resultCount: number;
  totalCount: number;
  right?: ReactNode;
}) {
  function set<K extends keyof CoffeeFilters>(key: K, value: CoffeeFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <div className="grid-toolbar">
      <input
        className="filter-search"
        placeholder="Search roaster, name, country…"
        value={filters.search}
        onChange={(e) => set("search", e.target.value)}
      />
      <select className="filter-select" value={filters.roaster} onChange={(e) => set("roaster", e.target.value)}>
        <option value="">All roasters</option>
        {roasters.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <select className="filter-select" value={filters.roast} onChange={(e) => set("roast", e.target.value)}>
        <option value="">Any roast</option>
        {ROAST_LEVELS.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
        <option value="__none__">No roast level</option>
      </select>
      <select className="filter-select" value={filters.year} onChange={(e) => set("year", e.target.value)}>
        <option value="">Any year</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
        <option value="__none__">No year</option>
      </select>
      <select className="filter-select" value={filters.rating} onChange={(e) => set("rating", e.target.value)}>
        <option value="">Any rating</option>
        {[1, 2, 3, 4, 5].map((r) => (
          <option key={r} value={r}>{r}★</option>
        ))}
        <option value="none">Unrated</option>
      </select>
      <select className="filter-select" value={filters.decaf} onChange={(e) => set("decaf", e.target.value)}>
        <option value="">Any decaf</option>
        <option value="yes">Decaf only</option>
        <option value="no">Not decaf</option>
      </select>
      {hasActiveFilters(filters) ? (
        <button type="button" className="btn secondary btn-small" onClick={() => onFiltersChange(emptyFilters())}>
          Reset
        </button>
      ) : null}

      <select
        className="filter-select"
        value={sort?.key ?? ""}
        onChange={(e) => {
          const key = e.target.value as SortKey | "";
          onSortChange(key ? { key, dir: sort?.dir ?? 1 } : null);
        }}
      >
        <option value="">Unsorted</option>
        {SORT_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>Sort: {o.label}</option>
        ))}
      </select>
      {sort ? (
        <button
          type="button"
          className="btn secondary btn-small"
          onClick={() => onSortChange({ key: sort.key, dir: sort.dir === 1 ? -1 : 1 })}
          title={sort.dir === 1 ? "Ascending" : "Descending"}
          aria-label="Toggle sort direction"
        >
          {sort.dir === 1 ? "▲" : "▼"}
        </button>
      ) : null}

      <span className="filter-count">{resultCount} of {totalCount}</span>
      <span className="toolbar-spacer" />
      {right}
    </div>
  );
}
