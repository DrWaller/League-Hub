import { NextRequest, NextResponse } from "next/server";
import { catchUpNights } from "@/lib/nightly-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-tap catch-up for the Big Night cards (commissioner only, like the rest of /api/admin).
// Saves any of the last few nights that aren't saved yet, then returns to the cards page.
//   /api/admin/nightly-blurbs/refresh              last 3 nights, skipping ones already saved
//   /api/admin/nightly-blurbs/refresh?days=5       look further back (up to 7)
//   /api/admin/nightly-blurbs/refresh?days=all     back to the start of the season (the Fantasy Monster count needs every night)
//   /api/admin/nightly-blurbs/refresh?force=1      re-save those nights even if already saved
// A long catch-up stops after about 45 seconds; open the link again to carry on (saved nights are skipped).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const all = q.get("days") === "all";
  const days = all ? 200 : Math.min(7, Math.max(1, Number(q.get("days")) || 3));
  const result = await catchUpNights(days, q.get("force") === "1", all ? 45000 : undefined);
  const back = new URL("/admin/big-night-cards", req.url);
  back.searchParams.set("refreshed", result.ok ? String(result.saved) : "error");
  if (result.stoppedEarly) back.searchParams.set("more", "1");
  if (all) {
    back.searchParams.set("checked", String(result.checked));
    back.searchParams.set("done", String(result.alreadyDone));
    back.searchParams.set("bad", String(result.unreadable));
    if (result.firstProblem) back.searchParams.set("why", result.firstProblem.slice(0, 160));
  }
  return NextResponse.redirect(back);
}
