import type { Metadata } from "next";
import Link from "next/link";
import NavMenu from "@/components/nav-menu";
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
            <NavMenu />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}