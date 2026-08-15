"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { saveGrid, findCoffeePhoto, type GridRow } from "@/app/actions";

type Cell = {
  roaster: string;
  name: string;
  origin: string;
  variety: string;
  process: string;
  roastLevel: string;
  roastDate: string;
  purchaseDate: string;
  price: string;
  weight: string;
  rating: string;
};

type Draft = Partial<Cell>;
type BaseRow = GridRow & { photoFile: string | null };
type Status = { kind: "saving" | "saved" | "finding" | "error"; msg?: string };

const ROAST_LEVELS = ["light", "medium-light", "medium", "medium-dark", "dark"];
const ROAST_ORDER = new Map(ROAST_LEVELS.map((l, i) => [l, i]));

const TEXT_FIELDS: (keyof Cell)[] = ["roaster", "name", "origin", "variety", "process"];
const SORT_KEYS = {
  Roaster: "roaster",
  Name: "name",
  Origin: "origin",
  Variety: "variety",
  Process: "process",
  Roast: "roastLevel",
  "Roast date": "roastDate",
  Purchased: "purchaseDate",
  Price: "price",
  "Weight (g)": "weight",
  Rating: "rating",
} as const;

function toCell(row: GridRow): Cell {
  return {
    roaster: row.roaster ?? "",
    name: row.name ?? "",
    origin: row.origin ?? "",
    variety: row.variety ?? "",
    process: row.process ?? "",
    roastLevel: row.roastLevel ?? "",
    roastDate: row.roastDate ?? "",
    purchaseDate: row.purchaseDate ?? "",
    price: row.priceCents != null ? (row.priceCents / 100).toFixed(2) : "",
    weight: row.weightGrams != null ? String(row.weightGrams) : "",
    rating: row.rating != null ? String(row.rating) : "",
  };
}

function toPayload(row: BaseRow, cell: Cell): GridRow {
  const price = cell.price.trim() === "" ? null : Math.round(Number(cell.price) * 100);
  const weight = cell.weight.trim() === "" ? null : Math.round(Number(cell.weight));
  return {
    id: row.id,
    roaster: cell.roaster.trim(),
    name: cell.name.trim(),
    origin: cell.origin.trim() || null,
    variety: cell.variety.trim() || null,
    process: cell.process.trim() || null,
    roastLevel: cell.roastLevel || null,
    roastDate: cell.roastDate || null,
    purchaseDate: cell.purchaseDate || null,
    priceCents: price !== null && Number.isFinite(price) ? price : null,
    weightGrams: weight !== null && Number.isFinite(weight) && weight > 0 ? weight : null,
    rating: cell.rating ? Number(cell.rating) : null,
  };
}

/* ---------- validation / formatting ---------- */

function sanitizePrice(raw: string): string {
  let out = "";
  let dot = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && !dot) {
      out += ch;
      dot = true;
    }
  }
  return out;
}

function formatPrice(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return t;
  return n.toFixed(2);
}

function sanitizeWeight(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 7);
}

function formatWeight(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const n = Math.round(Number(t));
  if (!Number.isFinite(n) || n < 1 || n > 1_000_000) return t;
  return String(n);
}

/* ---------- component ---------- */

export default function GridEditor({ beans }: { beans: BaseRow[] }) {
  const base = useMemo(() => beans.map((b) => ({ row: b, cell: toCell(b) })), [beans]);
  const [rows, setRows] = useState(base);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [cellErrors, setCellErrors] = useState<Record<number, { roaster?: boolean; name?: boolean }>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [filters, setFilters] = useState({ search: "", roaster: "", roast: "", rating: "" });

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const savingRef = useRef(new Set<number>());
  const pendingRef = useRef(new Set<number>());
  const findingRef = useRef(new Set<number>());
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const savedTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  function setCell(id: number, field: keyof Cell, value: string) {
    draftsRef.current = { ...draftsRef.current, [id]: { ...draftsRef.current[id], [field]: value } };
    setDrafts(draftsRef.current);
    if ((field === "roaster" || field === "name") && value.trim() !== "") {
      setCellErrors((e) => ({ ...e, [id]: { ...e[id], [field]: false } }));
    }
  }

  function setStatus(id: number, status: Status) {
    setStatuses((s) => ({ ...s, [id]: status }));
    if (status.kind === "saved") {
      const prev = savedTimers.current.get(id);
      if (prev) clearTimeout(prev);
      savedTimers.current.set(
        id,
        setTimeout(() => {
          setStatuses((s) => {
            const next = { ...s };
            delete next[id];
            return next;
          });
        }, 2200),
      );
    }
  }

  useEffect(() => {
    return () => {
      for (const t of savedTimers.current.values()) clearTimeout(t);
    };
  }, []);

  /* ---------- save on blur ---------- */

  async function saveRow(id: number) {
    if (savingRef.current.has(id)) {
      pendingRef.current.add(id);
      return;
    }
    const entry = rowsRef.current.find((r) => r.row.id === id);
    const draft = draftsRef.current[id];
    if (!entry || !draft) return;

    const merged = { ...entry.cell, ...draft };
    if (!merged.roaster.trim() || !merged.name.trim()) {
      setStatus(id, { kind: "error", msg: "Roaster and name are required." });
      return;
    }
    const payload = toPayload(entry.row, merged);
    const original = toPayload(entry.row, entry.cell);
    if (JSON.stringify(payload) === JSON.stringify(original)) {
      const next = { ...draftsRef.current };
      delete next[id];
      draftsRef.current = next;
      setDrafts(next);
      return;
    }

    savingRef.current.add(id);
    setStatus(id, { kind: "saving" });
    try {
      const res = await saveGrid([payload]);
      savingRef.current.delete(id);
      if (res.saved === 1) {
        rowsRef.current = rowsRef.current.map((en) => (en.row.id === id ? { ...en, cell: merged } : en));
        setRows(rowsRef.current);
        const next = { ...draftsRef.current };
        delete next[id];
        draftsRef.current = next;
        setDrafts(next);
        setStatus(id, { kind: "saved" });
        setCellErrors((e) => ({ ...e, [id]: { roaster: false, name: false } }));
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          void saveRow(id);
        }
      } else {
        setStatus(id, { kind: "error", msg: "Save failed." });
      }
    } catch {
      savingRef.current.delete(id);
      setStatus(id, { kind: "error", msg: "Could not save." });
    }
  }

  function handleBlur(id: number, field: keyof Cell) {
    const entry = rowsRef.current.find((r) => r.row.id === id);
    if (!entry) return;
    const raw = draftsRef.current[id]?.[field] ?? entry.cell[field] ?? "";

    let fixed = raw;
    if (field === "price") fixed = formatPrice(sanitizePrice(raw));
    else if (field === "weight") fixed = formatWeight(sanitizeWeight(raw));
    else if (TEXT_FIELDS.includes(field)) fixed = raw.trim();

    if (fixed !== raw) setCell(id, field, fixed);

    if ((field === "roaster" || field === "name") && fixed === "") {
      setCellErrors((e) => ({ ...e, [id]: { ...e[id], [field]: true } }));
      setStatus(id, { kind: "error", msg: "Roaster and name are required." });
      return;
    }
    void saveRow(id);
  }

  function cellValue(id: number, field: keyof Cell): string {
    const entry = rows.find((r) => r.row.id === id);
    if (!entry) return "";
    return drafts[id]?.[field] ?? entry.cell[field];
  }

  /* ---------- photo lookup ---------- */

  async function tryFindPhoto(id: number) {
    if (findingRef.current.has(id)) return;
    findingRef.current.add(id);
    setStatus(id, { kind: "finding" });
    const res = await findCoffeePhoto(id);
    findingRef.current.delete(id);
    if (res.ok) {
      rowsRef.current = rowsRef.current.map((en) => (en.row.id === id ? { ...en, row: { ...en.row, photoFile: res.photoFile } } : en));
      setRows(rowsRef.current);
      await new Promise((r) => setTimeout(r, 600)); // let the thumbnail render before chip fades
      setStatus(id, { kind: "saved" });
    } else {
      setStatus(id, { kind: "error", msg: res.message });
    }
  }

  async function findMissingPhotos() {
    const missing = rows.filter((r) => !r.row.photoFile).map((r) => r.row.id);
    if (missing.length === 0) return;
    setBatchMsg(`Finding photos… (0/${missing.length})`);
    let found = 0;
    for (let i = 0; i < missing.length; i++) {
      const id = missing[i];
      const before = rowsRef.current.find((r) => r.row.id === id)?.row.photoFile;
      await tryFindPhoto(id);
      const after = rowsRef.current.find((r) => r.row.id === id)?.row.photoFile;
      if (before !== after) found += 1;
      if (i % 5 === 0 || i === missing.length - 1) {
        setBatchMsg(`Finding… (${i + 1}/${missing.length}, ${found} found)`);
      }
    }
    setBatchMsg(`Done: found ${found} of ${missing.length}.`);
    setTimeout(() => setBatchMsg(null), 6000);
  }

  /* ---------- unsaved-changes guard (focused cell) ---------- */

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (Object.keys(draftsRef.current).length > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  /* ---------- filter + sort ---------- */

  const roasters = useMemo(
    () => [...new Set(rows.map((r) => r.row.roaster))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const batchCount = useMemo(() => rows.filter((r) => !r.row.photoFile).length, [rows]);

  const visible = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    let list = rows.filter(({ row, cell }) => {
      if (q && ![cell.roaster, cell.name, cell.origin, cell.variety, cell.process].some((f) => f.toLowerCase().includes(q))) {
        return false;
      }
      if (filters.roaster && row.roaster !== filters.roaster) return false;
      if (filters.roast) {
        if (filters.roast === "__none__" ? cell.roastLevel !== "" : cell.roastLevel !== filters.roast) return false;
      }
      if (filters.rating) {
        const v = row.rating;
        if (filters.rating === "none" ? v != null : v !== Number(filters.rating)) return false;
      }
      return true;
    });
    if (sort) {
      const { key, dir } = sort;
      list = [...list].sort((a, b) => {
        let va: unknown = a.cell[key as keyof Cell];
        let vb: unknown = b.cell[key as keyof Cell];
        if (key === "price") {
          va = a.row.priceCents;
          vb = b.row.priceCents;
        } else if (key === "weight") {
          va = a.row.weightGrams;
          vb = b.row.weightGrams;
        } else if (key === "rating") {
          va = a.row.rating;
          vb = b.row.rating;
        } else if (key === "roastLevel") {
          va = va ? ROAST_ORDER.get(va as string) : null;
          vb = vb ? ROAST_ORDER.get(vb as string) : null;
        }
        const na = va == null || va === "";
        const nb = vb == null || vb === "";
        if (na && nb) return 0;
        if (na) return 1;
        if (nb) return -1;
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va).localeCompare(String(vb)) * dir;
      });
    }
    return list;
  }, [rows, sort, filters]);

  function cycleSort(key: string) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 1 };
      if (s.dir === 1) return { key, dir: -1 };
      return null;
    });
  }

  function resetFilters() {
    setFilters({ search: "", roaster: "", roast: "", rating: "" });
  }

  return (
    <>
      <div className="grid-toolbar">
        <input
          className="filter-search"
          placeholder="Search roaster, name, origin…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <select className="filter-select" value={filters.roaster} onChange={(e) => setFilters((f) => ({ ...f, roaster: e.target.value }))}>
          <option value="">All roasters</option>
          {roasters.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="filter-select" value={filters.roast} onChange={(e) => setFilters((f) => ({ ...f, roast: e.target.value }))}>
          <option value="">Any roast</option>
          {ROAST_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          <option value="__none__">No roast level</option>
        </select>
        <select className="filter-select" value={filters.rating} onChange={(e) => setFilters((f) => ({ ...f, rating: e.target.value }))}>
          <option value="">Any rating</option>
          {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r}★</option>)}
          <option value="none">Unrated</option>
        </select>
        {(filters.search || filters.roaster || filters.roast || filters.rating) ? (
          <button type="button" className="btn secondary btn-small" onClick={resetFilters}>Reset</button>
        ) : null}
        <span className="filter-count">{visible.length} of {rows.length}</span>
        {batchMsg ? <span className="grid-saved">{batchMsg}</span> : null}
        <span className="grid-hint">Edits save automatically when you leave a cell.</span>
        <span className="toolbar-spacer" />
        <button
          type="button"
          className="btn btn-small"
          onClick={() => void findMissingPhotos()}
          disabled={batchCount === 0}
        >
          Find photos for {batchCount} missing
        </button>
      </div>

      <div className="table-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="col-photo">Photo</th>
              {Object.entries(SORT_KEYS).map(([label, key]) => (
                <th key={key} className={key === "price" || key === "weight" ? "num" : undefined}>
                  <button
                    type="button"
                    className={`th-sort${sort?.key === key ? " active" : ""}`}
                    onClick={() => cycleSort(key)}
                  >
                    {label}
                    {sort?.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
              <th className="col-status">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={13} className="grid-empty">No coffees match the filters.</td>
              </tr>
            ) : null}
            {visible.map(({ row }) => {
              const status = statuses[row.id];
              return (
                <tr key={row.id}>
                  <td className="col-photo">
                    {row.photoFile ? (
                      <Link href={`/coffees/${row.id}`}>
                        <img src={`/api/photos/${row.photoFile}`} alt="" className="grid-thumb" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        disabled={findingRef.current.has(row.id)}
                        onClick={() => void tryFindPhoto(row.id)}
                      >
                        {findingRef.current.has(row.id) ? "…" : "Find"}
                      </button>
                    )}
                  </td>
                  <td>
                    <input
                      value={cellValue(row.id, "roaster")}
                      className={cellErrors[row.id]?.roaster ? "cell-error" : undefined}
                      onChange={(e) => setCell(row.id, "roaster", e.target.value)}
                      onBlur={() => handleBlur(row.id, "roaster")}
                    />
                  </td>
                  <td>
                    <input
                      value={cellValue(row.id, "name")}
                      className={cellErrors[row.id]?.name ? "cell-error" : undefined}
                      onChange={(e) => setCell(row.id, "name", e.target.value)}
                      onBlur={() => handleBlur(row.id, "name")}
                    />
                  </td>
                  <td><input value={cellValue(row.id, "origin")} onChange={(e) => setCell(row.id, "origin", e.target.value)} onBlur={() => handleBlur(row.id, "origin")} /></td>
                  <td><input value={cellValue(row.id, "variety")} onChange={(e) => setCell(row.id, "variety", e.target.value)} onBlur={() => handleBlur(row.id, "variety")} /></td>
                  <td><input value={cellValue(row.id, "process")} onChange={(e) => setCell(row.id, "process", e.target.value)} onBlur={() => handleBlur(row.id, "process")} /></td>
                  <td>
                    <select value={cellValue(row.id, "roastLevel")} onChange={(e) => setCell(row.id, "roastLevel", e.target.value)} onBlur={() => handleBlur(row.id, "roastLevel")}>
                      <option value="">—</option>
                      {ROAST_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </td>
                  <td><input type="date" value={cellValue(row.id, "roastDate")} onChange={(e) => setCell(row.id, "roastDate", e.target.value)} onBlur={() => handleBlur(row.id, "roastDate")} /></td>
                  <td><input type="date" value={cellValue(row.id, "purchaseDate")} onChange={(e) => setCell(row.id, "purchaseDate", e.target.value)} onBlur={() => handleBlur(row.id, "purchaseDate")} /></td>
                  <td className="num">
                    <input inputMode="decimal" value={cellValue(row.id, "price")} placeholder="—" onChange={(e) => setCell(row.id, "price", sanitizePrice(e.target.value))} onBlur={() => handleBlur(row.id, "price")} />
                  </td>
                  <td className="num">
                    <input inputMode="numeric" value={cellValue(row.id, "weight")} placeholder="—" onChange={(e) => setCell(row.id, "weight", sanitizeWeight(e.target.value))} onBlur={() => handleBlur(row.id, "weight")} />
                  </td>
                  <td>
                    <select value={cellValue(row.id, "rating")} onChange={(e) => setCell(row.id, "rating", e.target.value)} onBlur={() => handleBlur(row.id, "rating")}>
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="col-status">
                    {status ? (
                      <span className={`status-chip ${status.kind}`}>
                        {status.kind === "saving" ? "saving…" : status.kind === "saved" ? "saved" : status.msg ?? "error"}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}