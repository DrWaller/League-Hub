"use client";

import { useEffect, useState } from "react";
import GraphicCard from "@/components/GraphicCard";

type Game = { homeTeamId: number; homeName: string; awayName: string; margin: number; tierLabel: string; card: string };
type State = { status: "loading" } | { status: "ok"; games: Game[]; message: string | null } | { status: "error"; message: string };

// One 1v1 card per close matchup, like the Big Night cards. Asks the route for the list of close games
// first (there may be none, one, or several), then shows a card for each.
//   mode "live"  = games still in play that are close right now (going into Saturday / Sunday)
//   mode "final" = finished games decided by a small margin
export default function CloseMatchupCards({ week, mode, season, title }: { week: number; mode: "live" | "final"; season?: string; title: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const seasonQS = mode === "final" && season ? `&season=${encodeURIComponent(season)}` : "";

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/admin/graphics/close-matchups?week=${week}&mode=${mode}${seasonQS}&list=1`, { cache: "no-store" })
      .then(async (res) => {
        const type = res.headers.get("content-type") || "";
        if (res.ok && type.includes("application/json")) {
          const d = await res.json();
          if (!cancelled) setState({ status: "ok", games: d.games ?? [], message: d.message ?? null });
          return;
        }
        const message = res.redirected
          ? "Your admin login has expired -- reload the page and log in again."
          : type.includes("text/html")
            ? `The server crashed while looking for close games (HTTP ${res.status}).`
            : (await res.text()).slice(0, 1500) || `Couldn't look for close games (HTTP ${res.status}).`;
        if (!cancelled) setState({ status: "error", message });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Network error while looking for close games." });
      });
    return () => {
      cancelled = true;
    };
  }, [week, mode, seasonQS]);

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl">{title}</h2>
      {state.status === "loading" && <p className="text-sm text-muted border border-ice-line p-4">Looking for close games…</p>}
      {state.status === "error" && <p className="text-sm border border-center-red/40 bg-ice-panel p-4 whitespace-pre-wrap">{state.message}</p>}
      {state.status === "ok" && state.games.length === 0 && (
        <p className="text-sm text-muted border border-ice-line p-4 whitespace-pre-wrap">{state.message ?? "No close games."}</p>
      )}
      {state.status === "ok" &&
        state.games.map((g) => (
          <GraphicCard key={g.card} title={`${g.tierLabel}: ${g.homeName} vs ${g.awayName}`} url={g.card} portrait />
        ))}
    </div>
  );
}
