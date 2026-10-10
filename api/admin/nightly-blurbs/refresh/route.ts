import { NextRequest, NextResponse } from "next/server";
import { catchUpNights } from "@/lib/nightly-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-tap catch-up for the Big Night cards (commissioner only, like the rest of /api/admin).
// Saves any of the last few nights that aren't saved yet, then returns to the cards page.
//   /api/admin/nightly-blurbs/refresh              last 3 nights, skipping ones already saved
//   /api/admin/nightly-blurbs/refresh?days=5       look further back (up to 7)
//   /api/admin/nightly-blurbs/refresh?force=1      re-save those nights even if already saved
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const days = Math.min(7, Math.max(1, Number(q.get("days")) || 3));
  const result = await catchUpNights(days, q.get("force") === "1");
  const back = new URL("/admin/big-night-cards", req.url);
  back.searchParams.set("refreshed", result.ok ? String(result.saved) : "error");
  return NextResponse.redirect(back);
}
