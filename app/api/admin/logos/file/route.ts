import { NextRequest } from "next/server";
import { getTeamLogos, getTeamSeasonLooks } from "@/lib/content";

export const dynamic = "force-dynamic";

// Hands a saved logo to the admin page in the browser (same origin, so the page can read the
// pixels to shrink it). Only a logo already saved in the database is ever fetched: a team's
// logo (?teamId=) or the logo saved for one team in one season (?season=&teamKey=).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const teamId = Number(params.get("teamId"));
  const season = Number(params.get("season"));
  const teamKey = params.get("teamKey");

  let url: string | undefined;
  if (teamId) {
    url = (await getTeamLogos())[teamId];
  } else if (season && teamKey) {
    url = (await getTeamSeasonLooks()).find((l) => l.season === season && l.teamKey === teamKey)?.logoUrl ?? undefined;
  } else {
    return new Response("teamId, or season and teamKey, is required", { status: 400 });
  }
  if (!url) return new Response("No logo is saved for that.", { status: 404 });

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) return new Response(`Couldn't read the logo (HTTP ${res.status}).`, { status: 502 });
  return new Response(await res.arrayBuffer(), {
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/octet-stream", "Cache-Control": "no-store" },
  });
}
