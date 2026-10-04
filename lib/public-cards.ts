import { NextRequest } from "next/server";

// The public (no login) copies of the player-card endpoints under /api/cards and /api/players.
// They are thin wrappers around the admin handlers, so the admin and public cards can never drift apart.
//
// Because anyone can open these, each answer is cached on Vercel's CDN for 15 minutes (the same card
// for the same player is made once, not once per visitor), debugging output is refused, and they can be
// switched off with the environment variable PUBLIC_PLAYER_CARDS=off.

export const PUBLIC_CACHE = "public, max-age=0, s-maxage=900, stale-while-revalidate=3600";

export async function publicVersion(req: NextRequest, handler: (r: NextRequest) => Promise<Response>): Promise<Response> {
  if (process.env.PUBLIC_PLAYER_CARDS === "off") return new Response("Not found", { status: 404 });
  if (req.nextUrl.searchParams.get("debug")) return new Response("Not found", { status: 404 });

  const res = await handler(req);
  const headers = new Headers(res.headers);
  headers.set("cache-control", res.ok ? PUBLIC_CACHE : "no-store"); // never cache an error
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
