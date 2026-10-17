import { NextRequest, NextResponse } from "next/server";
import { getLeagueMeta } from "@/lib/espn";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { fetchTransactionsRaw, parseTransactions } from "@/lib/roster-moves";

export const dynamic = "force-dynamic";

// Diagnostic for the Best Pickup race: what ESPN returns for one scoring day's transactions, and what the
// site made of it. /api/admin/transactions-probe?period=N (defaults to today's scoring day).
export async function GET(req: NextRequest) {
  const meta = await getLeagueMeta();
  const period = Number(req.nextUrl.searchParams.get("period")) || (await getCurrentScoringPeriod()).current || 1;
  const res = await fetchTransactionsRaw(meta.season, period);
  const txs: any[] = res.data?.transactions ?? [];
  const types: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  for (const t of txs) {
    types[String(t?.type)] = (types[String(t?.type)] ?? 0) + 1;
    statuses[String(t?.status)] = (statuses[String(t?.status)] ?? 0) + 1;
  }
  const parsed = res.data ? parseTransactions(meta.season, res.data) : [];
  return NextResponse.json({
    season: meta.season,
    period,
    espnOk: res.ok,
    httpStatus: res.status,
    topLevelKeys: res.data ? Object.keys(res.data) : null,
    transactionCount: txs.length,
    types,
    statuses,
    parsedMoves: parsed.length,
    parsedAdds: parsed.filter((m) => m.move === "add").length,
    sample: txs.slice(0, 3),
  });
}
