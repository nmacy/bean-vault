"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GridEditor from "@/components/grid-editor";
import { formatCents, photoUrl } from "@/lib/format";
import { cap } from "@/lib/cap";

const VIEW_KEY = "bean-vault:coffees-view";

export type BeanItem = {
  id: number;
  roaster: string;
  name: string;
  origin: string | null;
  variety: string | null;
  process: string | null;
  roastLevel: string | null;
  roastDate: string | null;
  purchaseDate: string | null;
  priceCents: number | null;
  weightGrams: number | null;
  rating: number | null;
  decaffeinated: boolean;
  photoFile: string | null;
};

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

export default function CollectionView({ beans }: { beans: BeanItem[] }) {
  const [view, setView] = useState<"tiles" | "grid">(readView);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  return (
    <>
      <div className="coffee-head">
        <h1>My coffees ({beans.length})</h1>
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

      {view === "tiles" ? <Tiles beans={beans} /> : <GridEditor beans={beans} />}
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
                {c.origin ? <span className="tag">{c.origin}</span> : null}
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