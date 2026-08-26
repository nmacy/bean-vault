import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roasters } from "@/db/schema";
import RoasterForm from "@/components/roaster-form";
import ScanRoasterWebsite from "@/components/scan-roaster-website";
import DeleteRoasterButton from "@/components/delete-roaster-button";
import { countRoasterCoffees } from "@/lib/roasters";
import { updateRoaster } from "@/app/actions";

export const metadata = { title: "Edit roaster · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function EditRoasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();

  const [roaster] = await db.select().from(roasters).where(eq(roasters.id, idNum));
  if (!roaster) notFound();
  const coffeeCount = await countRoasterCoffees(roaster.id, roaster.name);

  return (
    <main className="page">
      <Link href={`/roasters/${roaster.id}`} className="back-link">← Back to {roaster.name}</Link>
      <div className="page-head">
        <h1>Edit roaster</h1>
      </div>
      <ScanRoasterWebsite id={roaster.id} website={roaster.website} />
      <RoasterForm action={updateRoaster.bind(null, roaster.id)} roaster={roaster} submitLabel="Save changes" />
      <section className="form-card danger-zone">
        <h2 className="link-heading">Delete this roaster</h2>
        <p className="link-hint">Removes the roaster and its logo. This cannot be undone.</p>
        <DeleteRoasterButton id={roaster.id} coffeeCount={coffeeCount} />
      </section>
    </main>
  );
}
