"use client";

import { useEffect, useState } from "react";

const TOP_THREE_POSITIONS = [
  { value: "forward", label: "Top 3 Forwards" },
  { value: "defense", label: "Top 3 Defensemen" },
  { value: "goalie", label: "Top 3 Goalies" },
];

type State =
  | { status: "loading" }
  | { status: "ok"; src: string }
  | { status: "error"; message: string };

// Loads the image itself (rather than a bare <img>) so that when the server
// answers with an error instead of a picture -- "no final matchups yet",
// "ESPN isn't connected", a crash -- the actual message shows up here
// instead of a blank broken-image icon.
function GraphicCard({ title, url }: { title: string; url: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: "loading" });

    fetch(url)
      .then(async (res) => {
        const type = res.headers.get("content-type") || "";
        if (res.ok && type.startsWith("image/")) {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setState({ status: "ok", src: objectUrl });
          return;
        }
        let message: string;
        if (res.redirected) {
          message = "Your admin login has expired -- reload the page and log in again.";
        } else if (type.includes("text/html")) {
          message = `The server crashed while making this image (HTTP ${res.status}). The details are in Vercel's function logs.`;
        } else {
          message = (await res.text()).slice(0, 400) || `Couldn't generate this image (HTTP ${res.status}).`;
        }
        if (!cancelled) setState({ status: "error", message });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Network error while loading this image." });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg">{title}</h2>
        {state.status === "ok" && (
          <a href={url} download className="text-sm text-rink hover:underline">
            Download
          </a>
        )}
      </div>
      {state.status === "loading" && <p className="text-sm text-muted border border-ice-line p-4">Generating…</p>}
      {state.status === "error" && (
        <p className="text-sm border border-center-red/40 bg-ice-panel p-4">{state.message}</p>
      )}
      {state.status === "ok" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={state.src} alt={title} className="w-full border border-ice-line" />
      )}
    </div>
  );
}

export default function AdminGraphicsPage() {
  const [week, setWeek] = useState<number>(1);
  const [weekSeason, setWeekSeason] = useState<string>("");
  const [luckSeason, setLuckSeason] = useState<string>("");

  const seasonQS = weekSeason ? `&season=${encodeURIComponent(weekSeason)}` : "";

  const cards = [
    { title: "3 Stars of the Week", url: `/api/admin/graphics/three-stars?week=${week}${seasonQS}` },
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
            Applies to the three week-based graphics above. Leave blank for the current season --
            useful before this season has any stats posted yet, e.g. to check real players&apos;
            photos show up correctly.
          </div>
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
          <GraphicCard key={c.title} title={c.title} url={c.url} />
        ))}
      </div>
    </div>
  );
}
