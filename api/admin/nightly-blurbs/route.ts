import { NextResponse } from "next/server";
import { runNightly } from "@/lib/nightly-run";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Commissioner-only (under /api/admin like the other probes). A DRY RUN by
// default: shows what the nightly job would publish and nothing is saved.
//   /api/admin/nightly-blurbs                 -> last night, dry run
//   /api/admin/nightly-blurbs?period=40       -> a specific scoring day, dry run
//   /api/admin/nightly-blurbs?period=40&save=1 -> same, and save it (replaces that night)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const periodParam = url.searchParams.get("period");
  const period = periodParam ? Number(periodParam) : undefined;
  if (periodParam && (!Number.isInteger(period) || (period as number) < 1)) {
    return NextResponse.json({ ok: false, error: "period must be a whole number, 1 or more" }, { status: 400 });
  }
  const result = await runNightly({ period, save: url.searchParams.get("save") === "1" });
  return NextResponse.json(result);
}
