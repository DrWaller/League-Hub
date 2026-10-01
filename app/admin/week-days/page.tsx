"use client";

import { useEffect, useState } from "react";
import { dateRanges, parseEspnSchedule } from "@/lib/week-calendar-utils";

interface Facts {
  matchupPeriodCount: number | null;
  maxMatchupPeriod: number | null;
  finalScoringPeriod: number | null;
}

export default function WeekDaysPage() {
  const [season, setSeason] = useState<number | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [startDate, setStartDate] = useState("");
  const [lengths, setLengths] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const [pasted, setPasted] = useState("");

  useEffect(() => {
    fetch("/api/admin/week-days")
      .then((r) => r.json())
      .then((d) => {
        setSeason(d.season);
        setFacts(d.facts);
        if (d.saved) {
          setStartDate(d.saved.startDate ?? "");
          setLengths(d.saved.lengths);
          setSaved(true);
        } else {
          const n = d.facts?.maxMatchupPeriod || d.facts?.matchupPeriodCount || 22;
          setLengths(Array.from({ length: n }, () => 7));
        }
      })
      .catch(() => setMsg("Couldn't load. Is the site connected to ESPN and Postgres?"));
  }, []);

  const total = lengths.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const ranges = dateRanges(startDate, lengths);
  const finalDay = facts?.finalScoringPeriod ?? null;

  function fillFromPaste() {
    const parsed = season ? parseEspnSchedule(pasted, season - 1) : null;
    if (!parsed) return setMsg("Couldn't read that. Paste lines like: Matchup 1 (Sep 29 - Oct 4)");
    setStartDate(parsed.startDate);
    setLengths(parsed.lengths);
    setMsg(`Filled in ${parsed.lengths.length} weeks. Check the totals below, then Save.`);
  }

  async function save() {
    setMsg("");
    const res = await fetch("/api/admin/week-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season, startDate, lengths }),
    });
    const d = await res.json();
    if (!res.ok) return setMsg(d.error ?? "Couldn't save.");
    setSaved(true);
    setMsg("Saved. The player graphics will use these weeks.");
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Week Days{season ? ` - ${season}` : ""}</h1>
      <p className="text-muted mb-4 max-w-prose">
        This league scores daily, and ESPN doesn&apos;t tell the site which days belong to each matchup week. Enter how
        many days each week has, copying them from ESPN&apos;s schedule page (each matchup shows its dates). Player-based
        graphics (3 Stars, Top 3, Team of the Week, Player Spotlight) use this. One-time setup per season.
      </p>
      {!saved && (
        <p className="text-sm border border-center-red/40 bg-ice-panel p-3 max-w-2xl mb-4">
          Not saved yet, so the player graphics will show an error until you save this page.
        </p>
      )}

      <div className="max-w-xl mb-6">
        <div className="text-sm text-muted mb-1">Quickest way: paste ESPN&apos;s schedule list here (every Matchup and Playoff Round line)</div>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={4}
          placeholder={"Matchup 1 (Sep 29 - Oct 4)\nMatchup 2 (Oct 5 - 11)\n..."}
          className="border border-ice-line px-3 py-2 w-full font-mono text-xs"
        />
        <button onClick={fillFromPaste} className="mt-2 px-4 py-2 border border-rink text-rink text-sm">
          Fill in the weeks
        </button>
      </div>

      <label className="block text-sm mb-4">
        <div className="text-muted mb-1">Opening night (the date of scoring day 1) - optional, shows the dates so you can compare with ESPN</div>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-ice-line px-3 py-2 bg-white" />
      </label>

      <p className="text-sm mb-3">
        Total: <b>{total}</b> days
        {finalDay ? <> (ESPN&apos;s last scoring day is <b>{finalDay}</b>)</> : null}
        {finalDay && total !== finalDay ? <span className="text-muted"> - doesn&apos;t have to match, but a big gap means a week is probably off.</span> : null}
      </p>

      <div className="space-y-2 max-w-xl mb-6">
        {lengths.map((len, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="w-16 text-muted">Week {i + 1}</span>
            <input
              type="number"
              min={1}
              max={31}
              value={len}
              onChange={(e) => setLengths(lengths.map((x, j) => (j === i ? Number(e.target.value) : x)))}
              className="border border-ice-line px-2 py-1 w-20 bg-white"
            />
            <span className="text-muted">days</span>
            <span className="text-xs text-muted">{ranges[i]}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3 items-center">
        <button onClick={() => setLengths([...lengths, 7])} className="px-4 py-2 border border-ice-line text-sm">
          + Add a week
        </button>
        <button onClick={save} className="px-5 py-2 bg-rink text-ice">
          Save
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
