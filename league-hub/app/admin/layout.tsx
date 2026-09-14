"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/awards", label: "Weekly Awards" },
  { href: "/admin/matchups", label: "Matchup Blurbs" },
  { href: "/admin/keepers", label: "Keepers" },
  { href: "/admin/logos", label: "Team Logos" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  if (isLogin) return <>{children}</>;

  return (
    <div>
      <div className="bg-ice-panel border border-ice-line px-4 py-3 mb-8 flex items-center justify-between flex-wrap gap-3">
        <nav className="flex gap-4 text-sm flex-wrap">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "font-semibold text-rink" : "text-muted hover:text-rink"}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button onClick={handleLogout} className="text-sm text-muted hover:text-center-red">
          Log out
        </button>
      </div>
      {children}
    </div>
  );
}
