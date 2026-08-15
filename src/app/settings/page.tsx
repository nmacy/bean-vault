import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import SettingsForm from "@/components/settings-form";

export const metadata = { title: "Settings · Bean Vault" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const row = await db.select().from(settings).where(eq(settings.key, "openrouter_api_key"));
  const value = row[0]?.value ?? "";
  const source: "app" | "environment" | null = value
    ? "app"
    : process.env.OPENROUTER_API_KEY
      ? "environment"
      : null;

  return (
    <main className="page page-narrow">
      <Link href="/coffees" className="back-link">← Back to coffees</Link>
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      <SettingsForm configured={!!value} source={source} />
    </main>
  );
}