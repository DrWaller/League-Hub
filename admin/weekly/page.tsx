import Link from "next/link";
import { getLeagueMeta, getMatchups } from "@/lib/espn";
import { getWeeklyAwards, getMatchupContent, getNewsletterIntro } from "@/lib/content";
import { regularSeasonFinals } from "@/lib/luck";

export const dynamic = "force-dynamic";

// One page for the weekly routine: pick a week, see what's done, jump to
// what's left. Read-only -- each step links to the tool that does the work.
export default async function WeeklyChecklistPage({ searchParams }: { searchParams: { week?: string } }) {
  const meta = await getLeagueMeta();
  const { matchups } = await getMatchups();

  // Default to the latest week whose regular-season games are all final.
  const latestFinal = regularSeasonFinals(matchups).reduce((max, m) => Math.max(max, m.week), 0);
  const week = Math.max(1, Number(searchParams.week) || latestFinal || meta.currentWeek);

  const weekGames = matchups.filter((m) => m.week === week);
  const finalGames = weekGames.filter((m) => m.isFinal).length;
  const allFinal = weekGames.length > 0 && finalGames === weekGames.length;

  const [awards, blurbs, intro] = await Promise.all([
    getWeeklyAwards(meta.season, week),
    getMatchupContent(meta.season, week),
    getNewsletterIntro(meta.season, "week", String(week)),
  ]);
  const blurbCount = blurbs.filter((b) => b.summary && b.summary.trim()).length;
  const introSaved = !!intro?.introText?.trim();

  const steps: { title: string; status: "done" | "todo" | "info"; detail: string; links: { href: string; label: string }[] }[] = [
    {
      title: "Matchup blurbs",
      status: weekGames.length > 0 && blurbCount >= weekGames.length ? "done" : "todo",
      detail: `${blurbCount} of ${weekGames.length || "?"} matchups have a recap.`,
      links: [{ href: "/admin/matchups", label: "Write blurbs" }],
    },
    {
      title: "Weekly awards",
      status: awards.length > 0 ? "done" : "todo",
      detail: awards.length > 0 ? `${awards.length} awards saved.` : "Nothing saved yet — use Suggest from stats.",
      links: [{ href: "/admin/awards", label: "Open awards" }],
    },
    {
      title: "Weekly writeup",
      status: introSaved ? "done" : "todo",
      detail: introSaved ? "Intro saved." : "No intro saved yet — write it or use Generate Draft.",
      links: [
        { href: "/admin/newsletter", label: "Write the intro" },
        { href: `/newsletter?week=${week}`, label: "Preview newsletter" },
      ],
    },
    {
      title: "Weekly graphics",
      status: "info",
      detail: "3 Stars, Player Spotlight, Forward/Defense/Goalie, Team of the Week and the Luck Chart, all for this week.",
      links: [{ href: `/admin/graphics?week=${week}`, label: `Generate week ${week} graphics` }],
    },
    {
      title: "Power rankings",
      status: "info",
      detail: `Included in the newsletter as of week ${week}, with movement arrows. Also live on its own page.`,
      links: [
        { href: `/newsletter?week=${week}`, label: "See it in the newsletter" },
        { href: "/power-rankings", label: "Power Rankings page" },
      ],
    },
    {
      title: "Luck chart",
      status: "info",
      detail: `Included in the newsletter through week ${week}. The shareable image is in the graphics step.`,
      links: [{ href: `/power-rankings?week=${week}#luck`, label: "Luck Chart page" }],
    },
  ];

  const mark = { done: "✓", todo: "○", info: "•" } as const;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display text-3xl">Weekly Checklist</h1>
        <div className="flex items-center gap-3 font-tabular text-sm">
          <Link href={`/admin/weekly?week=${Math.max(1, week - 1)}`} className="px-2 py-1 border border-ice-line hover:border-rink-bright">
            ←
          </Link>
          <span>Week {week}</span>
          <Link href={`/admin/weekly?week=${week + 1}`} className="px-2 py-1 border border-ice-line hover:border-rink-bright">
            →
          </Link>
        </div>
      </div>
      <p className="text-muted mb-2 max-w-prose">The usual order once a week&apos;s games are final.</p>
      <p className="text-sm mb-8">
        {weekGames.length === 0
          ? "No games found for this week yet."
          : allFinal
          ? `All ${weekGames.length} games are final — ready to go.`
          : `${finalGames} of ${weekGames.length} games are final. Wait for the rest before publishing.`}
      </p>

      <ol className="space-y-3 max-w-2xl">
        {steps.map((s, i) => (
          <li key={s.title} className="border border-ice-line p-4">
            <div className="flex items-start gap-3">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{
                  background: s.status === "done" ? "#1F7A4D" : "transparent",
                  color: s.status === "done" ? "#fff" : "#5B6672",
                  border: s.status === "done" ? "none" : "1px solid #CBD6E2",
                }}
              >
                {mark[s.status]}
              </span>
              <div>
                <div className="font-display text-lg">
                  {i + 1}. {s.title}
                </div>
                <p className="text-sm text-muted mb-2">{s.detail}</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  {s.links.map((l) => (
                    <Link key={l.href + l.label} href={l.href} className="text-rink hover:underline">
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
