import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { coffees, roasters } from "@/db/schema";
import { formatCents, photoUrl } from "@/lib/format";
import { countRoasterCoffees } from "@/lib/roasters";

export const metadata = { title: "Roaster · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function RoasterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();

  const [roaster] = await db.select().from(roasters).where(eq(roasters.id, idNum));
  if (!roaster) notFound();

  const bags = await db
    .select()
    .from(coffees)
    .where(sql`${coffees.roasterId} = ${idNum} or lower(${coffees.roaster}) = lower(${roaster.name})`)
    .orderBy(desc(coffees.createdAt));

  const logoSrc = photoUrl(roaster.logoFile);
  const coffeeCount = await countRoasterCoffees(idNum, roaster.name);

  return (
    <main className="page">
      <Link href="/roasters" className="back-link">← Back to roasters</Link>
      <div className="detail">
        <div className="detail-photo roaster-logo">
          {logoSrc ? (
            <img src={logoSrc} alt={roaster.name} />
          ) : (
            <div className="placeholder">{roaster.name[0]?.toUpperCase() ?? "?"}</div>
          )}
        </div>
        <div>
          <h1>{roaster.name}</h1>
          {roaster.state || roaster.country ? (
            <p className="roaster">{[roaster.state, roaster.country].filter(Boolean).join(", ")}</p>
          ) : null}

          <dl className="fields">
            {roaster.specialty ? <><dt>Specialty</dt><dd>{roaster.specialty}</dd></> : null}
            {roaster.foundedYear ? <><dt>Founded</dt><dd>{roaster.foundedYear}</dd></> : null}
            {roaster.website ? (
              <>
                <dt>Website</dt>
                <dd><a href={roaster.website} target="_blank" rel="noreferrer noopener">{roaster.website}</a></dd>
              </>
            ) : null}
          </dl>

          {roaster.description ? <div className="notes">{roaster.description}</div> : null}

          <div className="tags">
            {roaster.aiEnriched ? <span className="tag tag-ai" title="Details filled with AI">AI</span> : null}
            <span className="tag">{coffeeCount} bag{coffeeCount === 1 ? "" : "s"}</span>
          </div>

          <div className="actions">
            <Link href={`/roasters/${roaster.id}/edit`} className="btn">Edit</Link>
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: 40 }}>Bags from {roaster.name}</h2>
      {bags.length === 0 ? (
        <div className="empty">
          <h2>No bags yet</h2>
        </div>
      ) : (
        <div className="grid">
          {bags.map((c) => {
            const src = photoUrl(c.photoFile);
            return (
              <Link key={c.id} href={`/coffees/${c.id}`} className="card">
                <div className="card-photo">
                  {src ? (
                    <img src={src} alt={c.name} loading="lazy" />
                  ) : (
                    <div className="placeholder">coffee</div>
                  )}
                </div>
                <div className="card-body">
                  <h3>{c.name}</h3>
                  <div className="meta">
                    <span>
                      {c.priceCents != null ? formatCents(c.priceCents) : ""}
                      {c.weightGrams != null ? ` · ${c.weightGrams} g` : ""}
                    </span>
                    {c.rating != null ? <span className="stars">{"★".repeat(c.rating)}</span> : null}
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
