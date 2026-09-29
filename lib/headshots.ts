// ESPN serves player headshots from a CDN keyed by the same numeric player id
// already present on every WeeklyPlayerStat (ESPN's fantasy roster API and its
// headshot CDN share one id space). Pattern: a.espncdn.com/i/headshots/{sport}/
// players/full/{id}.png -- confirmed for the "nhl" sport slug via independent
// documentation, but not something this environment can reach directly to
// test against ESPN's real servers (outside the sandbox's network allowlist),
// so the very first real-world check happens on a live deployment.
//
// Not every id has a photo on file -- ESPN returns 404 for those -- and
// next/og's renderer fetches an <img src> itself during rendering, so a
// missing photo there wouldn't just show a blank box, it could break the
// whole image. So callers must check availability first (checkHeadshots)
// and only render <img> for ids that come back true; anything else should
// fall back to the existing initials circle.

export function headshotUrl(espnPlayerId: number): string {
  return `https://a.espncdn.com/i/headshots/nhl/players/full/${espnPlayerId}.png`;
}

const TIMEOUT_MS = 2500;

async function exists(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(timer);
    // A real photo is a real image; a 404 (or ESPN's placeholder response,
    // which isn't image/* either) both fail this, which is exactly the point.
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false; // network hiccup, timeout, or anything else: fall back, don't crash the graphic
  }
}

// Checks a batch of player ids in parallel and returns which ones have a
// real photo on file. Safe to call with duplicate ids (checked once each).
export async function checkHeadshots(espnPlayerIds: number[]): Promise<Set<number>> {
  const unique = Array.from(new Set(espnPlayerIds));
  const results = await Promise.all(unique.map((id) => exists(headshotUrl(id))));
  const available = new Set<number>();
  results.forEach((ok, i) => {
    if (ok) available.add(unique[i]);
  });
  return available;
}
