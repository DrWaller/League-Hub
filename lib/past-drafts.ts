// Server-side only. A past ESPN season's draft, read live from ESPN (one cached call) for the Sleeping Beauty rebuild when
// that season's draft was never saved in the database. Player names come from the saved season stats.

import type { PoolRow } from "./player-trends";
import type { DraftPickLite } from "./past-awards";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;

export async function fetchEspnDraftPicks(season: number, rows: PoolRow[]): Promise<{ picks: DraftPickLite[]; note: string }> {
  if (!ESPN_S2 || !ESPN_SWID) return { picks: [], note: "ESPN login cookies are not configured." };
  try {
    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=mDraftDetail&view=mTeam`;
    const res = await fetch(url, { headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` }, next: { revalidate: 86400 } });
    if (!res.ok) return { picks: [], note: `ESPN answered ${res.status} for the ${season} draft.` };
    const data = await res.json();
    const picks: any[] = data?.draftDetail?.picks ?? [];
    if (picks.length === 0) return { picks: [], note: `ESPN has no ${season} draft.` };
    const byId = new Map(rows.filter((r) => r.season === season).map((r) => [r.id, r]));
    const teamName = new Map<number, string>((data.teams ?? []).map((t: any) => [t.id, t.name ?? [t.location, t.nickname].filter(Boolean).join(" ")]));
    const out: DraftPickLite[] = picks
      .map((p) => {
        const pl = byId.get(p.playerId);
        return pl
          ? { overallPick: Number(p.overallPickNumber), playerId: Number(p.playerId), name: pl.name, position: pl.position, teamName: teamName.get(p.teamId) ?? `Team ${p.teamId}`, keeper: Boolean(p.keeper) }
          : null;
      })
      .filter((x): x is DraftPickLite => x !== null);
    return { picks: out, note: out.length === 0 ? "None of the drafted players matched the saved stats." : "" };
  } catch (e) {
    return { picks: [], note: `Could not read the ${season} draft from ESPN: ${e instanceof Error ? e.message : String(e)}` };
  }
}
