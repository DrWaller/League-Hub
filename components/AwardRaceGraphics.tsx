"use client";

import { useState } from "react";
import GraphicCard from "@/components/GraphicCard";

const RACES: { key: string; title: string; url: string }[] = [
  { key: "hart", title: "Hart Watch", url: "/api/admin/graphics/award-watch?award=hart" },
  { key: "norris", title: "Norris Watch", url: "/api/admin/graphics/award-watch?award=norris" },
  { key: "vezina", title: "Vezina Watch", url: "/api/admin/graphics/award-watch?award=vezina" },
  { key: "forward", title: "Forward Watch", url: "/api/admin/graphics/award-watch?award=forward" },
  { key: "artross", title: "Art Ross Watch", url: "/api/admin/graphics/award-watch?award=artross" },
  { key: "efficiency", title: "Most Efficient Lineups", url: "/api/admin/graphics/lineup-season?" },
  { key: "presidents", title: "Presidents' Trophy", url: "/api/admin/graphics/award-race?race=presidents" },
  { key: "points", title: "Most Points Scored", url: "/api/admin/graphics/award-race?race=points" },
  { key: "hardluck", title: "Hard Luck Manager", url: "/api/admin/graphics/award-race?race=hardluck" },
  { key: "jennings", title: "William M. Jennings", url: "/api/admin/graphics/award-race?race=jennings" },
  { key: "sleeping", title: "Sleeping Beauty", url: "/api/admin/graphics/award-race?race=sleeping" },
  { key: "breakout", title: "Breakout Player", url: "/api/admin/graphics/award-race?race=breakout" },
  { key: "bounce", title: "Bounce Back Player", url: "/api/admin/graphics/award-race?race=bounce" },
  { key: "improved", title: "Most Improved Player", url: "/api/admin/graphics/award-race?race=improved" },
  { key: "calder", title: "Calder Trophy", url: "/api/admin/graphics/award-race?race=calder" },
];

// Nothing is rendered until you press Make graphic, so opening this page costs nothing; each graphic is one
// server render. Closing a card and reopening it renders it again, so leave it open while you save it.
export default function AwardRaceGraphics() {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 items-start">
      {RACES.map((r) => (
        <div key={r.key} className="border border-ice-line bg-white p-4">
          {open.has(r.key) ? (
            <>
              <GraphicCard title={r.title} url={r.url} portrait />
              <button onClick={() => toggle(r.key)} className="mt-3 text-sm text-muted hover:text-rink">Close</button>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg">{r.title}</h2>
              <button onClick={() => toggle(r.key)} className="bg-rink text-ice text-sm px-3 py-1.5 hover:bg-rink-deep">Make graphic</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
