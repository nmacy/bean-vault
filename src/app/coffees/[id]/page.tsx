import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import { formatCents, photoUrl } from "@/lib/format";
import { cap } from "@/lib/cap";
import DeleteButton from "@/components/delete-button";
import FindPhotoButton from "@/components/find-photo-button";

export const metadata = { title: "Coffee · Bean Vault" };
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
      <Link href="/coffees" className="back-link">← Back to coffees</Link>
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
            {coffee.country ? <><dt>Country</dt><dd>{coffee.country}</dd></> : null}
            {coffee.region ? <><dt>Region</dt><dd>{coffee.region}</dd></> : null}
            {coffee.producer ? <><dt>Producer</dt><dd>{coffee.producer}</dd></> : null}
            {coffee.elevation ? <><dt>Elevation</dt><dd>{coffee.elevation}</dd></> : null}
            {coffee.variety ? <><dt>Variety</dt><dd>{coffee.variety}</dd></> : null}
            {coffee.process ? <><dt>Process</dt><dd>{coffee.process}</dd></> : null}
            {coffee.roastLevel ? <><dt>Roast</dt><dd>{cap(coffee.roastLevel)}</dd></> : null}
            {coffee.roastDate ? <><dt>Roast date</dt><dd>{coffee.roastDate}</dd></> : null}
            {coffee.purchaseDate ? <><dt>Purchased</dt><dd>{coffee.purchaseDate}</dd></> : null}
            {coffee.priceCents != null ? <><dt>Price</dt><dd>{formatCents(coffee.priceCents)}</dd></> : null}
            {coffee.weightGrams != null ? <><dt>Weight</dt><dd>{coffee.weightGrams} g</dd></> : null}
          </dl>

          {coffee.tastingNotes ? (
            <div className="notes">
              <div className="notes-title">Tasting notes</div>
              {coffee.tastingNotes}
            </div>
          ) : null}

          {coffee.notes ? <div className="notes">{coffee.notes}</div> : null}

          <div className="tags">
            {coffee.aiEnriched ? <span className="tag tag-ai" title="Details filled with AI">AI</span> : null}
            {coffee.mix === "blend" ? <span className="tag">Blend</span> : coffee.mix === "single-origin" ? <span className="tag">Single origin</span> : null}
            {coffee.decaffeinated ? <span className="tag">Decaf</span> : null}
            <span className="tag">Added {coffee.createdAt.toLocaleDateString()}</span>
          </div>

          <div className="actions">
            <Link href={`/coffees/${coffee.id}/edit`} className="btn">Edit</Link>
            {!coffee.photoFile ? <FindPhotoButton id={coffee.id} /> : null}
            <DeleteButton id={coffee.id} />
          </div>
        </div>
      </div>
    </main>
  );
}