import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import { formatCents, photoUrl } from "@/lib/format";
import { cap } from "@/lib/cap";

export const metadata = { title: "Coffees · Bean Vault" };

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const all = await db.select().from(coffees).orderBy(desc(coffees.createdAt));

  return (
    <main className="page">
      <div className="page-head">
        <h1>My coffees</h1>
        <Link href="/new" className="btn">Add coffee</Link>
      </div>

      {all.length === 0 ? (
        <div className="empty">
          <h2>No coffee yet</h2>
          <p>Add the first bag you have bought.</p>
          <Link href="/new" className="btn">Add coffee</Link>
        </div>
      ) : (
        <div className="grid">
          {all.map((c) => {
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
      )}
    </main>
  );
}