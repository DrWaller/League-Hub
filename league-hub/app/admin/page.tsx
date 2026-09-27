import Link from "next/link";
import { getLeagueMeta } from "@/lib/espn";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const meta = await getLeagueMeta();

  const cards = [
    { href: "/admin/awards", label: "Weekly Awards", desc: "3 Stars, Forward/Defense/Goalie of the Week + runners-up." },
    { href: "/admin/graphics", label: "Graphics", desc: "Auto-generated shareable images from real weekly stats." },
    { href: "/admin/monthly-periods", label: "Monthly Periods", desc: "Define the week ranges Monthly Awards use." },
    { href: "/admin/monthly-awards", label: "Monthly Awards", desc: "Player picks + an automatic Manager of the Month." },
    { href: "/admin/newsletter", label: "Newsletter", desc: "Weekly recap and monthly wrap-up, AI-draftable." },
    { href: "/admin/matchups", label: "Matchup Blurbs", desc: "Write a preview or recap for any matchup." },
    { href: "/admin/keepers", label: "Keepers", desc: "Log who each team kept, season by season." },
    { href: "/admin/managers", label: "Managers", desc: "Track each owner across team-name changes over the years." },
    { href: "/admin/trades", label: "Trades", desc: "Log player movement between managers." },
    { href: "/admin/logos", label: "Team Logos", desc: "Upload a logo image for each team." },
    { href: "/admin/espn-history", label: "ESPN History Explorer", desc: "Check what ESPN's API returns for a past season." },
    { href: "/admin/import-records", label: "Import Records", desc: "Pull real win-loss records from ESPN for a past season." },
  ];

  const weeklySteps = [
    { href: "/admin/matchups", label: "Matchup Blurbs", desc: "Recap last week's games (or preview next week's)." },
    { href: "/admin/awards", label: "Weekly Awards", desc: `Suggest from stats, review, save week ${meta.currentWeek}.` },
    { href: "/admin/graphics", label: "Graphics", desc: "Generate and share this week's images." },
    { href: "/admin/newsletter", label: "Newsletter", desc: "Write or draft the intro, save." },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Commissioner Dashboard</h1>
      <p className="text-muted mb-8">
        {meta.liveDataConnected ? `Live — currently week ${meta.currentWeek}.` : "Preview data — connect ESPN to go live."}
      </p>

      <div className="border border-ice-line p-5 mb-10">
        <h2 className="font-display text-lg mb-1">This week</h2>
        <p className="text-xs text-muted mb-4">The usual order, once a week's games are final.</p>
        <ol className="space-y-2">
          {weeklySteps.map((s, i) => (
            <li key={s.href}>
              <Link href={s.href} className="flex items-center gap-3 hover:text-rink">
                <span className="w-6 h-6 rounded-full bg-rink text-ice flex items-center justify-center text-xs font-display shrink-0">
                  {i + 1}
                </span>
                <span>
                  <span className="font-body font-medium">{s.label}</span>
                  <span className="text-muted"> — {s.desc}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <h2 className="font-display text-xl mb-4">Everything else</h2>
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
