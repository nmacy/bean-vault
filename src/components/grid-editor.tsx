"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { saveGrid, type GridRow } from "@/app/actions";

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

const ROAST_LEVELS = ["light", "medium-light", "medium", "medium-dark", "dark"];

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

type BaseRow = GridRow & { photoFile: string | null };

function toPayload(row: BaseRow, cell: Cell): GridRow {
  const price = cell.price.trim() === "" ? null : Math.round(Number(cell.price) * 100);
  const weight = cell.weight.trim() === "" ? null : Math.round(Number(cell.weight));
  return {
    id: row.id,
    roaster: cell.roaster,
    name: cell.name,
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

export default function GridEditor({ beans }: { beans: BaseRow[] }) {
  const base = useMemo(() => beans.map((b) => ({ row: b, cell: toCell(b) })), [beans]);
  const [rows, setRows] = useState(base);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const dirtyIds = useMemo(() => {
    const ids: number[] = [];
    for (const { row, cell } of rows) {
      const draft = drafts[row.id];
      if (!draft) continue;
      const merged = { ...cell, ...draft };
      const orig = JSON.stringify(cell);
      const changed = JSON.stringify(merged) !== orig;
      // Value-level compare (same string after normalization counts as no change).
      const normalized = toPayload(row, merged);
      const original = toPayload(row, cell);
      if (changed && JSON.stringify(normalized) !== JSON.stringify(original)) ids.push(row.id);
    }
    return ids;
  }, [rows, drafts]);

  const dirtySet = useMemo(() => new Set(dirtyIds), [dirtyIds]);

  function setCell(id: number, field: keyof Cell, value: string) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setSavedMsg(null);
  }

  function cellValue(id: number, field: keyof Cell): string {
    const entry = rows.find((r) => r.row.id === id);
    if (!entry) return "";
    return drafts[id]?.[field] ?? entry.cell[field];
  }

  function isCellDirty(id: number, field: keyof Cell): boolean {
    const entry = rows.find((r) => r.row.id === id);
    if (!entry || !drafts[id]) return false;
    return drafts[id][field] !== undefined && drafts[id][field] !== entry.cell[field];
  }

  async function save() {
    setSaving(true);
    const payload = dirtyIds.map((id) => {
      const entry = rows.find((r) => r.row.id === id)!;
      return toPayload(entry.row, { ...entry.cell, ...drafts[id] });
    });
    const result = await saveGrid(payload);
    setSaving(false);
    if (result.saved > 0) {
      setRows(rows.map((entry) => ({ ...entry, cell: { ...entry.cell, ...drafts[entry.row.id] } })));
      setDrafts({});
      setSavedMsg(`Saved ${result.saved} coffee${result.saved === 1 ? "" : "s"}.`);
    }
  }

  function discard() {
    setDrafts({});
    setSavedMsg(null);
  }

  useEffect(() => {
    if (dirtyIds.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyIds.length]);

  return (
    <>
      <div className="grid-toolbar">
        <button className="btn" onClick={save} disabled={saving || dirtyIds.length === 0}>
          {saving ? "Saving…" : `Save changes${dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ""}`}
        </button>
        <button className="btn secondary" onClick={discard} disabled={saving || dirtyIds.length === 0}>
          Discard
        </button>
        {savedMsg ? <span className="grid-saved">{savedMsg}</span> : null}
        {dirtyIds.length > 0 ? <span className="grid-hint">Unsaved edits — cells are highlighted.</span> : null}
      </div>

      <div className="table-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="col-photo">Photo</th>
              <th>Roaster</th>
              <th>Name</th>
              <th>Origin</th>
              <th>Variety</th>
              <th>Process</th>
              <th>Roast</th>
              <th>Roast date</th>
              <th>Purchased</th>
              <th className="num">Price</th>
              <th className="num">Weight (g)</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row }) => (
              <tr key={row.id} className={dirtySet.has(row.id) ? "row-dirty" : undefined}>
                <td className="col-photo">
                  {row.photoFile ? (
                    <Link href={`/coffees/${row.id}`}>
                      <img src={`/api/photos/${row.photoFile}`} alt="" className="grid-thumb" />
                    </Link>
                  ) : (
                    <Link href={`/coffees/${row.id}`} className="grid-link">open</Link>
                  )}
                </td>
                <td><input value={cellValue(row.id, "roaster")} onChange={(e) => setCell(row.id, "roaster", e.target.value)} className={isCellDirty(row.id, "roaster") ? "cell-dirty" : undefined} /></td>
                <td><input value={cellValue(row.id, "name")} onChange={(e) => setCell(row.id, "name", e.target.value)} className={isCellDirty(row.id, "name") ? "cell-dirty" : undefined} /></td>
                <td><input value={cellValue(row.id, "origin")} onChange={(e) => setCell(row.id, "origin", e.target.value)} className={isCellDirty(row.id, "origin") ? "cell-dirty" : undefined} /></td>
                <td><input value={cellValue(row.id, "variety")} onChange={(e) => setCell(row.id, "variety", e.target.value)} className={isCellDirty(row.id, "variety") ? "cell-dirty" : undefined} /></td>
                <td><input value={cellValue(row.id, "process")} onChange={(e) => setCell(row.id, "process", e.target.value)} className={isCellDirty(row.id, "process") ? "cell-dirty" : undefined} /></td>
                <td>
                  <select value={cellValue(row.id, "roastLevel")} onChange={(e) => setCell(row.id, "roastLevel", e.target.value)} className={isCellDirty(row.id, "roastLevel") ? "cell-dirty" : undefined}>
                    <option value="">—</option>
                    {ROAST_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </td>
                <td><input type="date" value={cellValue(row.id, "roastDate")} onChange={(e) => setCell(row.id, "roastDate", e.target.value)} className={isCellDirty(row.id, "roastDate") ? "cell-dirty" : undefined} /></td>
                <td><input type="date" value={cellValue(row.id, "purchaseDate")} onChange={(e) => setCell(row.id, "purchaseDate", e.target.value)} className={isCellDirty(row.id, "purchaseDate") ? "cell-dirty" : undefined} /></td>
                <td className="num"><input inputMode="decimal" value={cellValue(row.id, "price")} placeholder="—" onChange={(e) => setCell(row.id, "price", e.target.value)} className={isCellDirty(row.id, "price") ? "cell-dirty" : undefined} /></td>
                <td className="num"><input inputMode="numeric" value={cellValue(row.id, "weight")} placeholder="—" onChange={(e) => setCell(row.id, "weight", e.target.value)} className={isCellDirty(row.id, "weight") ? "cell-dirty" : undefined} /></td>
                <td>
                  <select value={cellValue(row.id, "rating")} onChange={(e) => setCell(row.id, "rating", e.target.value)} className={isCellDirty(row.id, "rating") ? "cell-dirty" : undefined}>
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}