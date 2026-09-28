"use client";

import { useState } from "react";

const TOP_THREE_POSITIONS = [
  { value: "forward", label: "Top 3 Forwards" },
  { value: "defense", label: "Top 3 Defensemen" },
  { value: "goalie", label: "Top 3 Goalies" },
];

export default function AdminGraphicsPage() {
  const [week, setWeek] = useState<number>(1);

  const cards = [
    { title: "3 Stars of the Week", url: `/api/admin/graphics/three-stars?week=${week}` },
    ...TOP_THREE_POSITIONS.map((p) => ({ title: p.label, url: `/api/admin/graphics/top-three?week=${week}&position=${p.value}` })),
    { title: "Team of the Week", url: `/api/admin/graphics/team-of-week?week=${week}` },
    { title: "Luck Chart (through this week)", url: `/api/admin/graphics/luck-chart?week=${week}` },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Generate Graphics</h1>
      <p className="text-muted mb-2 max-w-prose">
        Real weekly stats from ESPN, rendered as shareable images — same visual style you approved
        on the design canvas. Right-click (or press-and-hold on mobile) any image to save it.
      </p>
      <p className="text-xs text-muted mb-8">
        Uses the same weekly stats as the Awards "Suggest" button, so it's worth confirming both
        line up correctly against a real week before relying on either.
      </p>

      <label className="text-sm inline-block mb-8">
        <div className="text-muted mb-1">Week</div>
        <input
          type="number"
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
          className="border border-ice-line px-3 py-2 w-28"
        />
      </label>

      <div className="space-y-10">
        {cards.map((c) => (
          <div key={c.title}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg">{c.title}</h2>
              <a href={c.url} download className="text-sm text-rink hover:underline">
                Download
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.url} alt={c.title} className="w-full border border-ice-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
