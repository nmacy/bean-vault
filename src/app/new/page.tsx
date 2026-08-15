import Link from "next/link";
import CoffeeForm from "@/components/coffee-form";
import { createCoffee } from "@/app/actions";

export const metadata = { title: "Add coffee · Coffee Tracker" };

export default function NewCoffeePage() {
  return (
    <main className="page">
      <Link href="/" className="back-link">← Back to all coffees</Link>
      <div className="page-head">
        <h1>Add coffee</h1>
      </div>
      <CoffeeForm action={createCoffee} submitLabel="Save coffee" />
    </main>
  );
}