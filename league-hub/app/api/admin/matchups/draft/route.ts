import { NextRequest, NextResponse } from "next/server";
import { getStandings, getMatchups, getWeeklyPlayerStats, getLeagueMeta } from "@/lib/espn";

// Drafts a short preview or recap using Claude, grounded in real data
// (scores, records, and that week's actual top performers) so the model
// has facts to work from instead of inventing plausible-sounding ones.
// The admin always reviews/edits the draft before it's saved anywhere.

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY isn't set. Add it in Vercel's environment variables to use this." },
      { status: 400 }
    );
  }

  const { week, homeTeamId, awayTeamId, mode } = await req.json();
  if (!week || !homeTeamId || !awayTeamId || !mode) {
    return NextResponse.json({ error: "week, homeTeamId, awayTeamId, and mode are required" }, { status: 400 });
  }

  const [meta, { teams }, { matchups }, { players }] = await Promise.all([
    getLeagueMeta(),
    getStandings(),
    getMatchups(week),
    getWeeklyPlayerStats(week),
  ]);

  const home = teams.find((t) => t.id === homeTeamId);
  const away = teams.find((t) => t.id === awayTeamId);
  const matchup = matchups.find((m) => m.homeTeamId === homeTeamId && m.awayTeamId === awayTeamId);

  if (!home || !away) {
    return NextResponse.json({ error: "Teams not found" }, { status: 404 });
  }

  const topFor = (teamId: number) =>
    players
      .filter((p) => p.teamId === teamId)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map((p) => `${p.name} (${p.points.toFixed(1)} pts)`)
      .join(", ") || "no stats posted yet";

  const facts =
    mode === "summary"
      ? [
          `League: ${meta.name}, Week ${week}`,
          `Final score: ${home.name} ${matchup?.homeScore ?? "?"} - ${away.name} ${matchup?.awayScore ?? "?"}`,
          `${home.name} record: ${home.wins}-${home.losses}${home.ties ? `-${home.ties}` : ""}, top scorers this week: ${topFor(home.id)}`,
          `${away.name} record: ${away.wins}-${away.losses}${away.ties ? `-${away.ties}` : ""}, top scorers this week: ${topFor(away.id)}`,
        ].join("\n")
      : [
          `League: ${meta.name}, Week ${week}`,
          `Upcoming matchup: ${home.name} (${home.wins}-${home.losses}${home.ties ? `-${home.ties}` : ""}, streak ${home.streak ?? "none"}) vs ${away.name} (${away.wins}-${away.losses}${away.ties ? `-${away.ties}` : ""}, streak ${away.streak ?? "none"})`,
        ].join("\n");

  const instructions =
    mode === "summary"
      ? "Write a short, punchy 2-3 sentence recap of this fantasy hockey matchup for a league website, in a fun commissioner-newsletter tone. Only use the facts given -- never invent stats, players, or events not listed."
      : "Write a short, punchy 2-3 sentence preview of this upcoming fantasy hockey matchup for a league website, in a fun commissioner-newsletter tone. Only use the facts given -- never invent stats, players, or predictions presented as fact.";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `${instructions}\n\nFacts:\n${facts}\n\nWrite only the recap/preview text itself, nothing else.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic API error", res.status, errText);
      return NextResponse.json({ error: "Draft generation failed. Check ANTHROPIC_API_KEY." }, { status: 502 });
    }

    const data = await res.json();
    const draft = data.content?.find((c: any) => c.type === "text")?.text?.trim() ?? "";
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("Draft generation error", err);
    return NextResponse.json({ error: "Draft generation failed." }, { status: 502 });
  }
}
