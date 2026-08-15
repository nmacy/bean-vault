import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coffees } from "@/db/schema";
import CoffeeForm from "@/components/coffee-form";
import { updateCoffee } from "@/app/actions";

export const metadata = { title: "Edit coffee · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function EditCoffeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();

  const [coffee] = await db.select().from(coffees).where(eq(coffees.id, idNum));
  if (!coffee) notFound();

  return (
    <main className="page">
      <Link href={`/coffees/${coffee.id}`} className="back-link">← Back to {coffee.name}</Link>
      <div className="page-head">
        <h1>Edit coffee</h1>
      </div>
      <CoffeeForm action={updateCoffee.bind(null, coffee.id)} coffee={coffee} submitLabel="Save changes" />
    </main>
  );
}