import { NextRequest } from "next/server";
import { getTeamLogos } from "@/lib/content";

export const dynamic = "force-dynamic";

// Hands a team's saved logo to the admin page in the browser (same origin, so the page can
// read the pixels to shrink it). Only the logo already saved for that team is ever fetched.
export async function GET(req: NextRequest) {
  const teamId = Number(req.nextUrl.searchParams.get("teamId"));
  if (!teamId) return new Response("teamId is required", { status: 400 });
  const url = (await getTeamLogos())[teamId];
  if (!url) return new Response("That team has no logo.", { status: 404 });
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) return new Response(`Couldn't read the logo (HTTP ${res.status}).`, { status: 502 });
  return new Response(await res.arrayBuffer(), {
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/octet-stream", "Cache-Control": "no-store" },
  });
}
