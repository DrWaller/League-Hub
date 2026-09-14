"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/matchups", label: "Matchups" },
  { href: "/rosters", label: "Rosters" },
  { href: "/power-rankings", label: "Power Rankings" },
  { href: "/awards", label: "Awards" },
  { href: "/keepers", label: "Keepers" },
  { href: "/managers", label: "Managers" },
  { href: "/history", label: "History" },
];

export default function Nav({ leagueName }: { leagueName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-rink text-ice">
      <div className="max-w-content mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="font-display text-xl tracking-wide uppercase">
            {leagueName}
          </Link>

          <nav className="hidden md:flex gap-6 font-body text-sm">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`py-2 border-b-2 transition-colors ${
                  pathname === link.href
                    ? "border-center-red text-white"
                    : "border-transparent text-ice/80 hover:text-white hover:border-ice/40"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <button
            className="md:hidden text-ice"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <nav className="md:hidden flex flex-col pb-4 font-body text-sm">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`py-2 ${pathname === link.href ? "text-white" : "text-ice/80"}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="rule-center" />
    </header>
  );
}
