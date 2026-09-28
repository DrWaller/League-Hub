import { NextRequest, NextResponse } from "next/server";
import { getStandings, getMatchups, getWeeklyPlayerStats, getManagerMonthSummary, getLeagueMeta } from "@/lib/espn";
import { getWeeklyAwards, getMatchupContent, getTrades, getMonthlyAwards, getManagers } from "@/lib/content";
import { AWARD_LABELS, AwardCategory } from "@/lib/types";

// Drafts a newsletter intro (weekly recap or monthly wrap-up) grounded in
// real compiled data -- same "facts first, then ask Claude to write it up"
// pattern as the matchup drafts. Always reviewed/edited before saving.

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY isn't set. Add it in Vercel's environment variables to use this." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { season, periodType, week, startWeek, endWeek, periodLabel } = body as {
    season: number;
    periodType: "week" | "month";
    week?: number;
    startWeek?: number;
    endWeek?: number;
    periodLabel?: string;
  };

  if (!season || !periodType) {
    return NextResponse.json({ error: "season and periodType are required" }, { status: 400 });
  }

  const meta = await getLeagueMeta();
  const { teams } = await getStandings();
  const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  const managers = await getManagers();
  const managerName = (id: number | null) => (id ? managers.find((m) => m.id === id)?.name ?? `#${id}` : "a free agent");

  let facts = `League: ${meta.name}\n`;

  if (periodType === "week" && week) {
    const [{ matchups }, awards, content, trades] = await Promise.all([
      getMatchups(week, season),
      getWeeklyAwards(season, week),
      getMatchupContent(season, week),
      getTrades(season),
    ]);

    facts += `Week ${week} results:\n`;
    for (const m of matchups) {
      facts += `- ${teamName(m.homeTeamId)} ${m.homeScore} vs ${teamName(m.awayTeamId)} ${m.awayScore}${m.isFinal ? " (final)" : ""}\n`;
    }
    if (awards.length > 0) {
      facts += `Weekly awards:\n`;
      for (const a of awards) {
        facts += `- ${AWARD_LABELS[a.category as AwardCategory]}: ${a.playerName}\n`;
      }
    }
    const weekTrades = trades.filter((t) => t.week === week);
    if (weekTrades.length > 0) {
      facts += `Trades this week:\n`;
      for (const t of weekTrades) {
        facts += `- ${t.playerName}: ${managerName(t.fromManagerId)} to ${managerName(t.toManagerId)}${t.note ? ` (${t.note})` : ""}\n`;
      }
    }
  } else if (periodType === "month" && startWeek && endWeek) {
    const [{ teams: monthSummary }, monthlyAwards, trades] = await Promise.all([
      getManagerMonthSummary(startWeek, endWeek, season),
      getMonthlyAwards(season, periodLabel || ""),
      getTrades(season),
    ]);

    facts += `${periodLabel || "This period"} (weeks ${startWeek}-${endWeek}) team results:\n`;
    const ranked = [...monthSummary].sort((a, b) => b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor);
    for (const s of ranked) {
      facts += `- ${teamName(s.teamId)}: ${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}, ${s.pointsFor} points for\n`;
    }
    if (monthlyAwards.length > 0) {
      facts += `Monthly awards:\n`;
      for (const a of monthlyAwards) {
        facts += `- ${AWARD_LABELS[a.category as AwardCategory]}: ${a.playerName}\n`;
      }
    }
    const periodTrades = trades.filter((t) => t.week !== null && t.week >= startWeek && t.week <= endWeek);
    if (periodTrades.length > 0) {
      facts += `Trades this period:\n`;
      for (const t of periodTrades) {
        facts += `- ${t.playerName}: ${managerName(t.fromManagerId)} to ${managerName(t.toManagerId)}${t.note ? ` (${t.note})` : ""}\n`;
      }
    }
  } else {
    return NextResponse.json({ error: "Missing week (for weekly) or startWeek/endWeek (for monthly)." }, { status: 400 });
  }

  const instructions =
    periodType === "week"
      ? "Write a short, fun 2-4 paragraph weekly newsletter recap for a fantasy hockey league website, in a lively commissioner-newsletter tone. Only use the facts given -- never invent scores, players, or events not listed."
      : "Write a short, fun 2-4 paragraph monthly wrap-up for a fantasy hockey league website, in a lively commissioner-newsletter tone, highlighting the top teams and top performers. Only use the facts given -- never invent stats, players, or events not listed.";

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
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: `${instructions}\n\nFacts:\n${facts}\n\nWrite only the newsletter text itself, nothing else.`,
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
    console.error("Newsletter draft generation error", err);
    return NextResponse.json({ error: "Draft generation failed." }, { status: 502 });
  }
}
