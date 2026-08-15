import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coffee Tracker",
  description: "Track the coffee you buy: roaster, origin, roast, price, and a snapshot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="brand">
              Coffee Tracker
              <small>the beans I buy</small>
            </Link>
            <Link href="/new" className="btn">
              Add coffee
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}