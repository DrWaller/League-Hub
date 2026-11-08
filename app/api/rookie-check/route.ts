import { NextRequest, NextResponse } from "next/server";
import { nhlSeasonId } from "@/lib/season-import";

export const dynamic = "force-dynamic";

// TEMPORARY diagnostic: does the NHL's public stats API have a rookie filter? Reads public NHL data only.
export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season")) || 2020;
  const base = "https://api.nhle.com/stats/rest/en";
  const sid = nhlSeasonId(season);
  const run = async (path: string, exp: string, sort = "points") => {
    const url = `${base}/${path}?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=${encodeURIComponent(exp)}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* not json */ }
      const data: any[] = Array.isArray(json?.data) ? json.data : [];
      return { status: res.status, count: data.length, total: json?.total ?? null, sample: data.slice(0, 3), keys: Object.keys(data[0] ?? {}), names: data.map((d) => d.skaterFullName ?? d.goalieFullName).filter(Boolean), raw: data.length ? undefined : text.slice(0, 300) };
    } catch (e) {
      return { error: String(e) };
    }
  };
  const [rookieSk, allSk, rookieG, bios] = await Promise.all([
    run("skater/summary", `gameTypeId=2 and seasonId=${sid} and isRookie=1`),
    run("skater/summary", `gameTypeId=2 and seasonId=${sid}`),
    run("goalie/summary", `gameTypeId=2 and seasonId=${sid} and isRookie=1`),
    run("skater/bios", `gameTypeId=2 and seasonId=${sid}`),
  ]);
  const pick = (r: any) => (r && r.names ? { ...r, names: r.names.slice(0, 60), sample: undefined } : r);
  return NextResponse.json({
    season, nhlSeason: sid,
    rookieSkaters: pick(rookieSk),
    allSkaters: { status: (allSk as any).status, count: (allSk as any).count },
    rookieGoalies: pick(rookieG),
    biosKeys: (bios as any).keys, biosStatus: (bios as any).status,
  });
}
