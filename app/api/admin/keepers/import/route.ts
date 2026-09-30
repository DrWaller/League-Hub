import { NextRequest, NextResponse } from "next/server";
import { addKeeper, getKeepers, getManagers, getManagerSeasons } from "@/lib/content";
import { keeperNote, parseCsv, parseKeeperGrid, parseTsv, sheetIdFrom } from "@/lib/keeper-import";

export const dynamic = "force-dynamic";

// Preview or apply a keeper import for ONE season.
// body: { season, sheet?: url-or-id, text?: pasted tab contents, apply?: boolean }
// Add-only: a keeper already on the site (same season, team and player) is
// skipped, so it's safe to run again as more keepers are submitted.
export async function POST(req: NextRequest) {
  const { season, sheet, text, apply } = await req.json();
  const seasonNum = Number(season);
  if (!seasonNum) return NextResponse.json({ error: "season is required" }, { status: 400 });

  let grid: string[][];
  if (typeof text === "string" && text.trim()) {
    grid = parseTsv(text);
  } else {
    const id = sheetIdFrom(String(sheet ?? ""));
    if (!id) return NextResponse.json({ error: "Enter the Google Sheet link, or paste the tab's contents." }, { status: 400 });
    const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${seasonNum}`;
    let body = "";
    try {
      const res = await fetch(url, { cache: "no-store", redirect: "follow" });
      body = await res.text();
      if (!res.ok || body.trimStart().startsWith("<")) throw new Error("not readable");
    } catch {
      return NextResponse.json(
        {
          error:
            "Couldn't read the sheet. In Google Sheets, click Share and set General access to \"Anyone with the link\" (Viewer), or use the paste box instead.",
        },
        { status: 400 }
      );
    }
    grid = parseCsv(body);
  }

  const parsed = parseKeeperGrid(grid);
  if (parsed.length === 0) {
    return NextResponse.json({ season: seasonNum, rows: [], unmatchedManagers: [], added: 0, message: "No keepers found for this season yet." });
  }

  const [managers, seasons, existing] = await Promise.all([getManagers(), getManagerSeasons(), getKeepers(seasonNum)]);
  const managerByName = new Map(managers.map((m) => [m.name.trim().toLowerCase(), m]));

  // The team a manager ran that season; if the season isn't linked to them yet
  // (typically the current one), fall back to their most recent earlier team.
  const teamFor = (managerId: number): { teamId: number; assumed: boolean } | null => {
    const mine = seasons.filter((s) => s.managerId === managerId);
    const exact = mine.find((s) => s.season === seasonNum);
    if (exact) return { teamId: exact.teamId, assumed: false };
    const earlier = mine.filter((s) => s.season < seasonNum).sort((a, b) => b.season - a.season)[0];
    return earlier ? { teamId: earlier.teamId, assumed: true } : null;
  };

  const have = new Set(existing.map((k) => `${k.teamId}|${k.playerName.trim().toLowerCase()}`));
  const unmatched = new Set<string>();
  const rows = parsed.map((k) => {
    const mgr = managerByName.get(k.manager.trim().toLowerCase());
    const team = mgr ? teamFor(mgr.id) : null;
    if (!mgr) unmatched.add(k.manager);
    let status: "new" | "exists" | "no-team" = "no-team";
    if (team) status = have.has(`${team.teamId}|${k.player.trim().toLowerCase()}`) ? "exists" : "new";
    return { ...k, teamId: team?.teamId ?? null, assumedTeam: team?.assumed ?? false, status };
  });

  let added = 0;
  if (apply) {
    for (const r of rows) {
      if (r.status !== "new" || r.teamId == null) continue;
      await addKeeper(seasonNum, r.teamId, r.player, keeperNote(r));
      added++;
    }
  }

  return NextResponse.json({ season: seasonNum, rows, unmatchedManagers: Array.from(unmatched), added });
}
