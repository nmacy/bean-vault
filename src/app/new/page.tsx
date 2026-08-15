import Link from "next/link";
import CoffeeForm from "@/components/coffee-form";
import LinkImportForm from "@/components/link-import-form";
import { createCoffee } from "@/app/actions";

export const metadata = { title: "Add coffee · Bean Vault" };

export default function NewCoffeePage() {
  return (
    <main className="page">
      <Link href="/coffees" className="back-link">← Back to all coffees</Link>
      <div className="page-head">
        <h1>Add coffee</h1>
      </div>
      <CoffeeForm action={createCoffee} submitLabel="Save coffee" />
      <LinkImportForm />
    </main>
  );
}