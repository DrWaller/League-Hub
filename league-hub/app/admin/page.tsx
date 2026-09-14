import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  const cards = [
    { href: "/admin/awards", label: "Weekly Awards", desc: "3 Stars, Forward/Defense/Goalie of the Week + runners-up." },
    { href: "/admin/matchups", label: "Matchup Blurbs", desc: "Write a preview or recap for any matchup." },
    { href: "/admin/keepers", label: "Keepers", desc: "Log who each team kept, season by season." },
    { href: "/admin/logos", label: "Team Logos", desc: "Upload a logo image for each team." },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl mb-8">Commissioner Dashboard</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="border border-ice-line p-5 hover:border-rink-bright transition-colors">
            <h2 className="font-display text-lg mb-1">{c.label}</h2>
            <p className="text-sm text-muted">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
