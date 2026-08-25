"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { photoUrl } from "@/lib/format";

export type RoasterItem = {
  id: number;
  name: string;
  website: string | null;
  state: string | null;
  country: string | null;
  description: string | null;
  specialty: string | null;
  foundedYear: number | null;
  logoFile: string | null;
  aiEnriched: boolean;
  coffeeCount: number;
};

export default function RoastersView({ roasters }: { roasters: RoasterItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roasters;
    return roasters.filter((r) => r.name.toLowerCase().includes(q));
  }, [roasters, query]);

  return (
    <>
      <div className="coffee-head">
        <h1>Roasters ({filtered.length})</h1>
      </div>

      <div className="grid-toolbar">
        <input
          className="filter-search"
          type="text"
          placeholder="Search roasters…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h2>No roasters yet</h2>
          <p>Roasters are created automatically when you add a bag of their coffee.</p>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((r) => {
            const src = photoUrl(r.logoFile);
            return (
              <Link key={r.id} href={`/roasters/${r.id}`} className="card">
                <div className="card-photo roaster-logo">
                  {src ? (
                    <img src={src} alt={r.name} loading="lazy" />
                  ) : (
                    <div className="placeholder">{r.name[0]?.toUpperCase() ?? "?"}</div>
                  )}
                </div>
                <div className="card-body">
                  <h3>{r.name}</h3>
                  {r.state || r.country ? (
                    <div className="roaster">{[r.state, r.country].filter(Boolean).join(", ")}</div>
                  ) : null}
                  {r.description ? <p className="roaster-blurb">{r.description}</p> : null}
                  <div className="tags">
                    <span className="tag">{r.coffeeCount} bag{r.coffeeCount === 1 ? "" : "s"}</span>
                    {r.aiEnriched ? <span className="tag tag-ai" title="Details filled with AI">AI</span> : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
