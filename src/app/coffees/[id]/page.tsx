import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import { formatCents, photoUrl } from "@/lib/format";
import { cap } from "@/lib/cap";
import DeleteButton from "@/components/delete-button";

export const metadata = { title: "Coffee · Coffee Tracker" };
export const dynamic = "force-dynamic";

export default async function CoffeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();

  const [coffee] = await db.select().from(coffees).where(eq(coffees.id, idNum));
  if (!coffee) notFound();

  const src = photoUrl(coffee.photoFile);

  return (
    <main className="page">
      <Link href="/" className="back-link">← Back to all coffees</Link>
      <div className="detail">
        <div className="detail-photo">
          {src ? (
            <img src={src} alt={`${coffee.roaster} ${coffee.name}`} />
          ) : (
            <div className="placeholder">coffee</div>
          )}
        </div>
        <div>
          <h1>{coffee.name}</h1>
          <p className="roaster">{coffee.roaster}</p>
          {coffee.rating != null ? (
            <div className="stars-lg">
              {"★".repeat(coffee.rating)}
              <span style={{ color: "#d8c9b8" }}>{"★".repeat(5 - coffee.rating)}</span>
            </div>
          ) : null}

          <dl className="fields">
            {coffee.origin ? <><dt>Origin</dt><dd>{coffee.origin}</dd></> : null}
            {coffee.variety ? <><dt>Variety</dt><dd>{coffee.variety}</dd></> : null}
            {coffee.process ? <><dt>Process</dt><dd>{coffee.process}</dd></> : null}
            {coffee.roastLevel ? <><dt>Roast</dt><dd>{cap(coffee.roastLevel)}</dd></> : null}
            {coffee.roastDate ? <><dt>Roast date</dt><dd>{coffee.roastDate}</dd></> : null}
            {coffee.purchaseDate ? <><dt>Purchased</dt><dd>{coffee.purchaseDate}</dd></> : null}
            {coffee.priceCents != null ? <><dt>Price</dt><dd>{formatCents(coffee.priceCents)}</dd></> : null}
            {coffee.weightGrams != null ? <><dt>Weight</dt><dd>{coffee.weightGrams} g</dd></> : null}
          </dl>

          {coffee.notes ? <div className="notes">{coffee.notes}</div> : null}

          <div className="tags">
            <span className="tag">Added {coffee.createdAt.toLocaleDateString()}</span>
          </div>

          <div className="actions">
            <Link href={`/coffees/${coffee.id}/edit`} className="btn">Edit</Link>
            <DeleteButton id={coffee.id} />
          </div>
        </div>
      </div>
    </main>
  );
}