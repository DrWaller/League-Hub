"use client";

import { Fragment, useEffect, useState } from "react";
import GraphicCard from "@/components/GraphicCard";
import CloseMatchupCards from "@/components/CloseMatchupCards";

const TOP_THREE_POSITIONS = [
  { value: "forward", label: "Top 3 Forwards" },
  { value: "defense", label: "Top 3 Defensemen" },
  { value: "goalie", label: "Top 3 Goalies" },
];

export default function AdminGraphicsPage() {
  const [week, setWeek] = useState<number>(1);
  const [weekSeason, setWeekSeason] = useState<string>("");
  const [luckSeason, setLuckSeason] = useState<string>("");
  const [spotlightPosition, setSpotlightPosition] = useState<string>("any");
  const [awardRace, setAwardRace] = useState<string>("norris");

  // Player Radar picker: search ESPN's player list by name; with nobody picked the
  // radar uses the week's top scorer.
  const [radarPlayer, setRadarPlayer] = useState<{ id: number; name: string } | null>(null);
  const [radarQuery, setRadarQuery] = useState("");
  const [radarResults, setRadarResults] = useState<{ id: number; name: string; position: string }[]>([]);
  useEffect(() => {
    const q = radarQuery.trim();
    if (q.length < 2) {
      setRadarResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/admin/players/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setRadarResults(d.players ?? []))
        .catch(() => setRadarResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [radarQuery]);
  const [format, setFormat] = useState<"landscape" | "portrait">("portrait");

  // Open on the current season and week, or on the week chosen on the Weekly Checklist (?week=N).
  const [currentSeason, setCurrentSeason] = useState<number | null>(null);
  useEffect(() => {
    const w = Number(new URLSearchParams(window.location.search).get("week"));
    if (w >= 1) setWeek(w);
    fetch("/api/admin/league-meta")
      .then((r) => r.json())
      .then((m) => {
        if (Number.isFinite(m?.season)) setCurrentSeason(Number(m.season));
        if (!(w >= 1) && m?.live && Number(m?.week) >= 1) setWeek(Number(m.week));
      })
      .catch(() => {
        /* stay on week 1 / blank season */
      });
  }, []);

  // The season box shows the current season; the graphics only get a season param for a DIFFERENT
  // season, so the current one keeps using the live (not day-cached) ESPN data.
  const pastWeekSeason = weekSeason && Number(weekSeason) !== currentSeason ? weekSeason : "";
  const seasonQS = pastWeekSeason ? `&season=${encodeURIComponent(pastWeekSeason)}` : "";

  // Monthly Periods for the chosen season, for the 3 Stars of the Month card.
  type Period = { id: number; label: string; startWeek: number; endWeek: number };
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const periodSeason = pastWeekSeason || (currentSeason != null ? String(currentSeason) : "");
  useEffect(() => {
    if (!periodSeason) return;
    fetch(`/api/admin/monthly-periods?season=${encodeURIComponent(periodSeason)}`)
      .then((r) => r.json())
      .then((list) => setPeriods(Array.isArray(list) ? list : []))
      .catch(() => setPeriods([]));
  }, [periodSeason]);
  // Open on the period that contains the chosen week (else the latest one), unless one was picked.
  useEffect(() => {
    if (periods.length === 0) return;
    if (periods.some((p) => String(p.id) === periodId)) return;
    const inWeek = periods.find((p) => p.startWeek <= week && week <= p.endWeek);
    setPeriodId(String((inWeek ?? periods[periods.length - 1]).id));
  }, [periods, week, periodId]);
  const period = periods.find((p) => String(p.id) === periodId);

  const fmtQS = `&format=${format}`;

  const rawCards: { title: string; url: string; alwaysPortrait?: boolean }[] = [
    {
      title: radarPlayer ? `Player Radar - ${radarPlayer.name}` : "Player Radar (week's top scorer)",
      url: `/api/admin/graphics/player-radar?week=${week}${radarPlayer ? `&playerId=${radarPlayer.id}` : ""}`,
      alwaysPortrait: true,
    },
    {
      title: radarPlayer ? `Player Bars - ${radarPlayer.name}` : "Player Bars (week's top scorer)",
      url: `/api/admin/graphics/player-bars?week=${week}${radarPlayer ? `&playerId=${radarPlayer.id}` : ""}`,
      alwaysPortrait: true,
    },
    { title: "Standings", url: `/api/admin/graphics/standings?week=${week}${seasonQS}` },
    { title: "Matchup Preview (upcoming week)", url: `/api/admin/graphics/matchup-preview?week=${week}` },
    { title: "Weekly Scoreboard", url: `/api/admin/graphics/scoreboard?week=${week}${seasonQS}` },
    { title: "Power Rankings", url: `/api/admin/graphics/power-rankings?week=${week}` },
    { title: "3 Stars of the Week", url: `/api/admin/graphics/three-stars?week=${week}${seasonQS}` },
    {
      title: "Player Spotlight",
      url: `/api/admin/graphics/player-spotlight?week=${week}&position=${spotlightPosition}${seasonQS}`,
    },
    {
      title: "Player Spotlight - Full Season",
      url: `/api/admin/graphics/player-spotlight-season?position=${spotlightPosition}${seasonQS}`,
      alwaysPortrait: true,
    },
    ...TOP_THREE_POSITIONS.map((p) => ({
      title: p.label,
      url: `/api/admin/graphics/top-three?week=${week}&position=${p.value}${seasonQS}`,
    })),
    { title: "Lineup Efficiency (points vs. best lineup)", url: `/api/admin/graphics/lineup-efficiency?week=${week}`, alwaysPortrait: true },
    { title: "Lineup Efficiency Race (season to date)", url: `/api/admin/graphics/lineup-season?week=${week}`, alwaysPortrait: true },
    { title: `Award Watch - ${awardRace}`, url: `/api/admin/graphics/award-watch?award=${awardRace}&week=${week}`, alwaysPortrait: true },
    { title: "League Awards", url: `/api/admin/graphics/league-awards?week=${week}`, alwaysPortrait: true },
    { title: "Team of the Week", url: `/api/admin/graphics/team-of-week?week=${week}${seasonQS}` },
    ...(period
      ? [
          {
            title: `3 Stars of the Month - ${period.label}`,
            url: `/api/admin/graphics/three-stars-month?startWeek=${period.startWeek}&endWeek=${period.endWeek}&label=${encodeURIComponent(period.label)}${seasonQS}`,
            alwaysPortrait: true,
          },
        ]
      : []),
    { title: "Top Players by VOR", url: `/api/admin/graphics/top-vor?week=${week}${seasonQS}`, alwaysPortrait: true },
    luckSeason
      ? {
          title: `Luck Chart — end of ${luckSeason}`,
          url: `/api/admin/graphics/luck-chart?season=${encodeURIComponent(luckSeason)}`,
        }
      : { title: "Luck Chart (through this week)", url: `/api/admin/graphics/luck-chart?week=${week}` },
  ];
  const cards = rawCards.map((c) => ({ ...c, url: c.url + fmtQS }));

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Generate Graphics</h1>
      <p className="text-muted mb-2 max-w-prose">
        Real weekly stats from ESPN, rendered as shareable images — same visual style you approved
        on the design canvas. Press-and-hold (or right-click) any image to save it, or use Download.
      </p>
      <p className="text-xs text-muted mb-8 max-w-prose">
        If an image can't be made yet (for example, no games have been played that week), the reason
        shows here instead of the picture. The Luck Chart also lives on the public Power Rankings page.
      </p>

      <div className="flex flex-wrap gap-6 mb-8">
        <label className="text-sm inline-block">
          <div className="text-muted mb-1">Week</div>
          <input
            type="number"
            min={1}
            value={week}
            onChange={(e) => setWeek(Math.max(1, Number(e.target.value) || 1))}
            className="border border-ice-line px-3 py-2 w-28"
          />
        </label>

        <label className="text-sm inline-block">
          <div className="text-muted mb-1">Season (optional)</div>
          <input
            type="number"
            placeholder="e.g. 2026"
            value={weekSeason || (currentSeason ?? "")}
            onChange={(e) => setWeekSeason(e.target.value)}
            className="border border-ice-line px-3 py-2 w-36"
          />
          <div className="text-xs text-muted mt-1 max-w-[16rem]">
            Applies to the week-based graphics above. Opens on the current season --
            change it to look at another one, e.g. before this season has any stats posted yet, e.g. to check real players&apos;
            photos show up correctly.
          </div>
        </label>

        <div className="text-sm inline-block relative">
          <div className="text-muted mb-1">Player Radar player</div>
          {radarPlayer ? (
            <div className="flex items-center gap-2 border border-ice-line px-3 py-2 w-64 bg-white">
              <span className="truncate">{radarPlayer.name}</span>
              <button onClick={() => setRadarPlayer(null)} className="ml-auto text-rink hover:underline">
                Clear
              </button>
            </div>
          ) : (
            <input
              value={radarQuery}
              onChange={(e) => setRadarQuery(e.target.value)}
              placeholder="Search by name (blank = top scorer)"
              className="border border-ice-line px-3 py-2 w-64 bg-white"
            />
          )}
          {!radarPlayer && radarResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-64 border border-ice-line bg-white shadow">
              {radarResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setRadarPlayer({ id: r.id, name: r.name });
                    setRadarQuery("");
                    setRadarResults([]);
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-ice-panel"
                >
                  {r.name} <span className="text-muted">({r.position})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="text-sm inline-block">
          <div className="text-muted mb-1">Month (3 Stars of the Month)</div>
          <select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            disabled={periods.length === 0}
            className="border border-ice-line px-3 py-2 w-56 bg-white"
          >
            {periods.length === 0 && <option value="">No monthly periods set</option>}
            {periods.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.label} (weeks {p.startWeek}-{p.endWeek})
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm inline-block">
          <div className="text-muted mb-1">Shape</div>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "landscape" | "portrait")}
            className="border border-ice-line px-3 py-2 w-44 bg-white"
          >
            <option value="portrait">Portrait (phone / Instagram)</option>
            <option value="landscape">Landscape (wide)</option>
          </select>
        </label>

        <label className="text-sm inline-block">
          <div className="text-muted mb-1">Player Spotlight position</div>
          <select
            value={spotlightPosition}
            onChange={(e) => setSpotlightPosition(e.target.value)}
            className="border border-ice-line px-3 py-2 w-40 bg-white"
          >
            <option value="any">Top scorer (any)</option>
            <option value="forward">Forward</option>
            <option value="defense">Defenseman</option>
            <option value="goalie">Goalie</option>
          </select>
        </label>

        <label className="text-sm inline-block">
          <div className="text-muted mb-1">Award Watch race</div>
          <select value={awardRace} onChange={(e) => setAwardRace(e.target.value)} className="border border-ice-line px-3 py-2 w-44 bg-white">
            <option value="hart">Hart (MVP)</option>
            <option value="norris">Norris (D)</option>
            <option value="vezina">Vezina (G)</option>
            <option value="forward">Forward of the Year</option>
            <option value="artross">Art Ross (points)</option>
          </select>
        </label>

        <label className="text-sm inline-block">
          <div className="text-muted mb-1">Luck Chart season (optional)</div>
          <input
            type="number"
            placeholder="e.g. 2026"
            value={luckSeason}
            onChange={(e) => setLuckSeason(e.target.value)}
            className="border border-ice-line px-3 py-2 w-36"
          />
          <div className="text-xs text-muted mt-1 max-w-[16rem]">
            Leave blank for the current season. A past season shows its final chart.
          </div>
        </label>
      </div>

      <div className="space-y-10">
        {cards.map((c) => (
          <Fragment key={c.title}>
            <GraphicCard title={c.title} url={c.url} portrait={format === "portrait" || Boolean(c.alwaysPortrait)} />
            {c.title === "Weekly Scoreboard" && (
              <>
                <CloseMatchupCards week={week} mode="live" title="Close Matchups - live (going into the weekend)" />
                <CloseMatchupCards week={week} mode="final" season={pastWeekSeason} title="Close Matchups - final scores" />
              </>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
