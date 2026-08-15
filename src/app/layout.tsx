import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bean Vault",
  description: "Track the coffee you buy: roaster, origin, roast, price, and a snapshot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="brand">
              <img src="/bean-vault-header.png" alt="Bean Vault" className="brand-mark" />
            </Link>
            <nav style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Link href="/grid" className="btn secondary">Grid</Link>
              <Link href="/import" className="btn secondary">Import</Link>
              <Link href="/new" className="btn">Add coffee</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}