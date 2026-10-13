import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureDraftSchema } from "@/lib/draft";
import { parseDraftPaste } from "@/lib/draft-paste";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin-only (covered by the /api/admin middleware).
//   POST { season, text }              preview: shows how the paste was read, writes nothing
//   POST { season, text, apply: true } saves it as the season's draft (source "fantrax"), replacing any earlier paste
//   GET                                lists the drafts saved so far
export async function GET() {
  try {
    await ensureDraftSchema();
    const r = await sql`SELECT season, source, COUNT(*)::int AS n FROM draft_picks GROUP BY season, source ORDER BY season DESC;`;
    return NextResponse.json({ saved: r.rows });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const season = Number(body.season);
    if (!season) return NextResponse.json({ error: "Pick a season." }, { status: 400 });
    const parsed = parseDraftPaste(String(body.text ?? ""));
    if (parsed.picks.length === 0) return NextResponse.json({ error: "No picks found in the paste.", ...parsed }, { status: 400 });
    if (!body.apply) return NextResponse.json({ mode: "preview (nothing saved)", season, ...parsed });
    if (parsed.errors.length > 0) return NextResponse.json({ error: "Fix the errors first.", ...parsed }, { status: 400 });

    await ensureDraftSchema();
    const teams = Math.max(1, new Set(parsed.picks.map((p) => p.team).filter(Boolean)).size || 10);
    await sql`DELETE FROM draft_picks WHERE season = ${season} AND source = 'fantrax';`;
    for (let i = 0; i < parsed.picks.length; i += 20) {
      await Promise.all(
        parsed.picks.slice(i, i + 20).map(
          (p) => sql`
            INSERT INTO draft_picks (season, source, overall_pick, round, round_pick, team_name, player_name, position, is_keeper, nhl_team)
            VALUES (${season}, 'fantrax', ${p.overall}, ${Math.ceil(p.overall / teams)}, ${((p.overall - 1) % teams) + 1}, ${p.team}, ${p.player}, ${p.position}, ${p.keeper}, ${p.nhl ?? null})
            ON CONFLICT (season, source, overall_pick) DO NOTHING;
          `
        )
      );
    }
    return NextResponse.json({ mode: "saved", season, saved: parsed.picks.length, warnings: parsed.warnings });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}
