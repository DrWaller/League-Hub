"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Twelve flat links were too many to read at once. They are grouped by what a visitor is trying to do;
// Players stays on its own because it is a feature people come to directly. The wordmark is the Home link.
type Item = { href: string; label: string };
type Entry = { label: string; href?: string; items?: Item[] };

const NAV: Entry[] = [
  {
    label: "Season",
    items: [
      { href: "/standings", label: "Standings" },
      { href: "/matchups", label: "Matchups" },
      { href: "/rosters", label: "Rosters" },
      { href: "/power-rankings", label: "Power Rankings" },
      { href: "/last-night", label: "Big Nights" },
    ],
  },
  { label: "Players", href: "/players" },
  {
    label: "League",
    items: [
      { href: "/awards", label: "Awards" },
      { href: "/newsletter", label: "Newsletter" },
      { href: "/keepers", label: "Keepers" },
      { href: "/managers", label: "Managers" },
    ],
  },
  {
    label: "History",
    items: [
      { href: "/history", label: "League History" },
      { href: "/records", label: "Records" },
    ],
  },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
const groupActive = (pathname: string, e: Entry) => (e.href ? isActive(pathname, e.href) : (e.items ?? []).some((i) => isActive(pathname, i.href)));

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" className={`ml-1.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
      <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Nav({ leagueName }: { leagueName: string }) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);

  // Close menus after navigating, on Escape, and when clicking elsewhere.
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenMenu(null);
    const onClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const topLink = (active: boolean) =>
    `inline-flex items-center py-2 border-b-2 transition-colors whitespace-nowrap ${
      active ? "border-center-red text-white" : "border-transparent text-ice/80 hover:text-white hover:border-ice/40"
    }`;

  return (
    <header className="bg-rink text-ice">
      <div className="max-w-content mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-8">
          <Link href="/" className="font-display text-xl tracking-wide uppercase whitespace-nowrap shrink-0">
            {leagueName}
          </Link>

          <nav ref={barRef} className="hidden md:flex items-center gap-8 font-body text-sm" aria-label="Main">
            {NAV.map((entry) =>
              entry.href ? (
                <Link key={entry.label} href={entry.href} className={topLink(groupActive(pathname, entry))}>
                  {entry.label}
                </Link>
              ) : (
                <div
                  key={entry.label}
                  className="relative"
                  onMouseEnter={() => setOpenMenu(entry.label)}
                  onMouseLeave={() => setOpenMenu((m) => (m === entry.label ? null : m))}
                >
                  <button
                    type="button"
                    className={topLink(groupActive(pathname, entry))}
                    aria-haspopup="menu"
                    aria-expanded={openMenu === entry.label}
                    onClick={() => setOpenMenu(openMenu === entry.label ? null : entry.label)}
                  >
                    {entry.label}
                    <Chevron open={openMenu === entry.label} />
                  </button>
                  {openMenu === entry.label && (
                    <div className="absolute left-0 top-full z-30 min-w-[11rem] bg-rink-deep border-t-2 border-center-red shadow-lg py-1" role="menu">
                      {entry.items!.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          className={`block px-4 py-2 whitespace-nowrap hover:bg-rink ${isActive(pathname, item.href) ? "text-white font-semibold" : "text-ice/85 hover:text-white"}`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </nav>

          <button className="md:hidden text-ice" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <nav className="md:hidden pb-5 font-body text-sm space-y-4" aria-label="Main">
            {NAV.map((entry) =>
              entry.href ? (
                <Link key={entry.label} href={entry.href} className={`block py-1.5 text-base ${groupActive(pathname, entry) ? "text-white font-semibold" : "text-ice/90"}`}>
                  {entry.label}
                </Link>
              ) : (
                <div key={entry.label}>
                  <div className="text-xs uppercase tracking-widest text-ice/50 mb-1">{entry.label}</div>
                  {entry.items!.map((item) => (
                    <Link key={item.href} href={item.href} className={`block py-1.5 pl-3 border-l border-ice/20 ${isActive(pathname, item.href) ? "text-white font-semibold" : "text-ice/85"}`}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )
            )}
          </nav>
        )}
      </div>
      <div className="rule-center" />
    </header>
  );
}
