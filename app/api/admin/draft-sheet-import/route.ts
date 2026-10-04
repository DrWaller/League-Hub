import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fetchSheetRows, parseSheetPlayers, storeSheetPlayers, loadSheetMap, pickSheet } from "@/lib/player-sheet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin-only (covered by the /api/admin middleware).
//   /api/admin/draft-sheet-import          preview: reads the sheet, shows how well it matches the draft
//   /api/admin/draft-sheet-import?run=1    stores it in player_sheet (replaces the previous import)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const season = Number(q.get("season")) || 2027;
  const run = q.get("run") === "1";
  try {
    const players = parseSheetPlayers(await fetchSheetRows());

    let written = 0;
    if (run) written = await storeSheetPlayers(players);

    // Match report against the stored draft (uses what is in the database now).
    const map = await loadSheetMap();
    const draftRows = (await sql`
      SELECT overall_pick, is_keeper, player_name, position FROM draft_picks
      WHERE season = ${season} AND source = 'espn' ORDER BY overall_pick;
    `).rows as any[];

    // Before the first run the table is empty, so match against the parsed sheet directly.
    const live = run || map.size > 0 ? map : new Map<string, typeof players>();
    if (live.size === 0) for (const p of players) live.set(p.name_key, [...(live.get(p.name_key) ?? []), p]);

    const unmatched = draftRows.filter((r) => !pickSheet(live as any, r.player_name, r.position));
    const matched = draftRows.length - unmatched.length;
    const sample = draftRows.slice(0, 5).map((r) => {
      const p = pickSheet(live as any, r.player_name, r.position);
      return { player: r.player_name, sheetTeam: p?.nhl_team ?? null, age: p?.age ?? null, sheetPos: p?.position ?? null };
    });

    return NextResponse.json({
      mode: run ? "stored" : "preview (nothing written)",
      sheetPlayers: players.length,
      written,
      draftPlayers: draftRows.length,
      matched,
      unmatched: unmatched.map((r) => `${r.player_name} (${r.position}, ${r.is_keeper ? "keeper" : "#" + r.overall_pick})`),
      missingAge: draftRows.filter((r) => pickSheet(live as any, r.player_name, r.position)?.age == null).length,
      sample,
      projKeysSeen: Object.keys(players.find((p) => p.position === "C")?.proj ?? {}),
      goalieProjKeysSeen: Object.keys(players.find((p) => p.position === "G")?.proj ?? {}),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 500) }, { status: 500 });
  }
}
