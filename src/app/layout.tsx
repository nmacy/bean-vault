import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import NavMenu from "@/components/nav-menu";
import ThemeToggle from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bean Vault",
  description: "Track the coffee you buy: roaster, origin, roast, price, and a snapshot.",
};

// Applied before first paint to avoid a light-mode flash for dark users.
// Reads the cookie set by theme-toggle.tsx if localStorage is unreadable
// (some WebKit browsers restrict storage per-site without going fully
// private, which silently drops localStorage writes).
const THEME_BOOTSTRAP = `(function(){try{var s=null;try{s=localStorage.getItem('bean-vault:theme')}catch(e){}if(!s){var m=document.cookie.match(/(?:^|; )bean_vault_theme=([^;]*)/);if(m)s=decodeURIComponent(m[1])}var dark=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(dark)document.documentElement.classList.add('dark')}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="brand">
              <img src="/bean-vault-header.png" alt="Bean Vault" className="brand-mark" />
            </Link>
            <div className="header-actions">
              <ThemeToggle />
              <NavMenu />
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}