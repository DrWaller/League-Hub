"use client";

import { useEffect, useState } from "react";
import GraphicCard from "@/components/GraphicCard";

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

  // Open with the week chosen on the Weekly Checklist (?week=N).
  useEffect(() => {
    const w = Number(new URLSearchParams(window.location.search).get("week"));
    if (w >= 1) setWeek(w);
  }, []);

  const seasonQS = weekSeason ? `&season=${encodeURIComponent(weekSeason)}` : "";

  const fmtQS = `&format=${format}`;

  const rawCards: { title: string; url: string; alwaysPortrait?: boolean }[] = [
    {
      title: radarPlayer ? `Player Radar - ${radarPlayer.name}` : "Player Radar (week's top scorer)",
      url: `/api/admin/graphics/player-radar?week=${week}${radarPlayer ? `&playerId=${radarPlayer.id}` : ""}`,
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
    ...TOP_THREE_POSITIONS.map((p) => ({
      title: p.label,
      url: `/api/admin/graphics/top-three?week=${week}&position=${p.value}${seasonQS}`,
    })),
    { title: "Team of the Week", url: `/api/admin/graphics/team-of-week?week=${week}${seasonQS}` },
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
            value={weekSeason}
            onChange={(e) => setWeekSeason(e.target.value)}
            className="border border-ice-line px-3 py-2 w-36"
          />
          <div className="text-xs text-muted mt-1 max-w-[16rem]">
            Applies to the week-based graphics above. Leave blank for the current season --
            useful before this season has any stats posted yet, e.g. to check real players&apos;
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
          <GraphicCard key={c.title} title={c.title} url={c.url} portrait={format === "portrait" || Boolean(c.alwaysPortrait)} />
        ))}
      </div>
    </div>
  );
}
