"use client";

import { useEffect, useRef, useState } from "react";
import GraphicCard from "@/components/GraphicCard";

// The weekly newsletter, in the order it gets sent to the group. Each graphic
// is the same one the Graphics page makes -- this just puts the 11 you send in
// order, ready to share in one go. All are the phone/Instagram shape except the
// Luck Chart, which is a wide table and is made in landscape.
const PARTS: { slug: string; title: string; path: (week: number) => string; landscape?: boolean }[] = [
  { slug: "scoreboard", title: "Weekly Scoreboard", path: (w) => `scoreboard?week=${w}` },
  { slug: "standings", title: "Standings", path: (w) => `standings?week=${w}` },
  { slug: "power-rankings", title: "Power Rankings", path: (w) => `power-rankings?week=${w}` },
  { slug: "three-stars", title: "3 Stars of the Week", path: (w) => `three-stars?week=${w}` },
  { slug: "top-forwards", title: "Top 3 Forwards", path: (w) => `top-three?week=${w}&position=forward` },
  { slug: "top-defensemen", title: "Top 3 Defensemen", path: (w) => `top-three?week=${w}&position=defense` },
  { slug: "top-goalies", title: "Top 3 Goalies", path: (w) => `top-three?week=${w}&position=goalie` },
  { slug: "team-of-the-week", title: "Team of the Week", path: (w) => `team-of-week?week=${w}` },
  { slug: "player-spotlight", title: "Player Spotlight", path: (w) => `player-spotlight?week=${w}&position=any` },
  { slug: "luck-chart", title: "Luck Chart", path: (w) => `luck-chart?week=${w}`, landscape: true }, // wide table reads best landscape
  { slug: "next-week-matchups", title: "Next Week's Matchups", path: (w) => `matchup-preview?week=${w + 1}` },
];

const pad = (n: number) => String(n).padStart(2, "0");

export default function NewsletterGraphicsPage() {
  const [week, setWeek] = useState<number>(1);
  const [ready, setReady] = useState<boolean[]>(() => PARTS.map(() => false));
  const [message, setMessage] = useState<string>("");
  const blobs = useRef<(Blob | null)[]>(PARTS.map(() => null));

  // Open on the week chosen on the Weekly Checklist (?week=N), else the latest finished week.
  useEffect(() => {
    const w = Number(new URLSearchParams(window.location.search).get("week"));
    if (w >= 1) setWeek(w);
    fetch("/api/admin/league-meta")
      .then((r) => r.json())
      .then((m) => {
        if (!(w >= 1) && m?.live && Number(m?.week) >= 1) setWeek(Number(m.week));
      })
      .catch(() => {
        /* stay on week 1 */
      });
  }, []);

  function onBlob(i: number, blob: Blob | null) {
    blobs.current[i] = blob;
    setReady((prev) => {
      const next = [...prev];
      next[i] = blob !== null;
      return next;
    });
  }

  const readyCount = ready.filter(Boolean).length;
  const missing = PARTS.map((p, i) => ({ p, i })).filter(({ i }) => !ready[i]);

  function fileFor(i: number): File | null {
    const b = blobs.current[i];
    if (!b) return null;
    return new File([b], `week${week}-${pad(i + 1)}-${PARTS[i].slug}.png`, { type: b.type || "image/png" });
  }

  // Opens the phone's share sheet with every finished image in order (WhatsApp, iMessage, etc.).
  async function shareAll() {
    const files = PARTS.map((_, i) => fileFor(i)).filter((f): f is File => f !== null);
    if (files.length === 0) {
      setMessage("Nothing is ready yet.");
      return;
    }
    try {
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files, title: `Fantasy Hockey - Week ${week}` });
        setMessage(files.length < PARTS.length ? `Shared ${files.length} of ${PARTS.length}. The ones that couldn't be made are listed below.` : "");
        return;
      }
      setMessage("This browser can't share images directly, so use 'Download all' instead.");
    } catch (e) {
      // Closing the share sheet counts as an AbortError: not a failure.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setMessage("Sharing didn't work here -- use 'Download all' instead.");
    }
  }

  // Saves the finished images with numbered names (01-..., 02-...) so they stay in order.
  async function downloadAll() {
    let n = 0;
    for (let i = 0; i < PARTS.length; i++) {
      const f = fileFor(i);
      if (!f) continue;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      n++;
      await new Promise((r) => setTimeout(r, 400));
    }
    setMessage(n > 0 ? `Downloaded ${n} image${n === 1 ? "" : "s"}, numbered in order.` : "Nothing is ready yet.");
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display text-3xl">Newsletter Graphics</h1>
        <label className="text-sm flex items-center gap-2">
          <span className="text-muted">Week</span>
          <input
            type="number"
            min={1}
            value={week}
            onChange={(e) => setWeek(Math.max(1, Number(e.target.value) || 1))}
            className="border border-ice-line px-3 py-2 w-24"
          />
        </label>
      </div>
      <p className="text-muted mb-4 max-w-prose">
        The {PARTS.length} graphics for the weekly newsletter, in the order to send them. The last one previews week {week + 1}.
        Each has its own caption and Download buttons, or send them all at once below.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <button onClick={shareAll} disabled={readyCount === 0} className="bg-rink text-white px-4 py-2 disabled:opacity-40">
          Share all in order
        </button>
        <button onClick={downloadAll} disabled={readyCount === 0} className="border border-ice-line px-4 py-2 disabled:opacity-40">
          Download all
        </button>
        <span className="text-sm text-muted">
          {readyCount} of {PARTS.length} ready
        </span>
      </div>
      {message && <p className="text-sm mb-2">{message}</p>}
      {readyCount < PARTS.length && readyCount > 0 && missing.length > 0 && (
        <p className="text-xs text-muted mb-2 max-w-prose">
          Not ready: {missing.map(({ p, i }) => `${i + 1}. ${p.title}`).join(", ")}. Sharing skips any that failed; the reason shows on its card.
        </p>
      )}

      <div className="space-y-10 mt-8">
        {PARTS.map((p, i) => (
          <GraphicCard
            key={p.slug}
            title={`${i + 1}. ${p.title}`}
            url={`/api/admin/graphics/${p.path(week)}&format=${p.landscape ? "landscape" : "portrait"}`}
            portrait={!p.landscape}
            onBlob={(b) => onBlob(i, b)}
          />
        ))}
      </div>
    </div>
  );
}
