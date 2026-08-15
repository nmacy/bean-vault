"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Views",
    links: [
      { href: "/", label: "Dashboard" },
      { href: "/coffees", label: "All coffees" },
      { href: "/grid", label: "Grid" },
    ],
  },
  {
    label: "Actions",
    links: [
      { href: "/new", label: "Add coffee" },
      { href: "/import", label: "Import" },
    ],
  },
  {
    label: "Data",
    links: [
      { href: "/api/export", label: "Export CSV" },
      { href: "/api/export/json", label: "Backup (with photos)" },
    ],
  },
];

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav className={`nav-menu${open ? " open" : ""}`} ref={ref} aria-label="Main">
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
      </button>
      {open ? (
        <div className="nav-panel">
          {GROUPS.map((g) => (
            <div key={g.label} className="nav-group">
              <div className="nav-group-label">{g.label}</div>
              {g.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`nav-link${pathname === l.href ? " active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </nav>
  );
}