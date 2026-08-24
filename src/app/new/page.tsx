import Link from "next/link";
import CoffeeForm from "@/components/coffee-form";
import LinkImportForm from "@/components/link-import-form";
import { createCoffee, resolveAiKey } from "@/app/actions";

export const metadata = { title: "Add coffee · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function NewCoffeePage() {
  const hasAiKey = Boolean((await resolveAiKey()).trim());

  return (
    <main className="page">
      <Link href="/coffees" className="back-link">← Back to coffees</Link>
      <div className="page-head">
        <h1>Add coffee</h1>
      </div>
      <LinkImportForm />
      <CoffeeForm action={createCoffee} submitLabel="Save coffee" hasAiKey={hasAiKey} />
    </main>
  );
}
