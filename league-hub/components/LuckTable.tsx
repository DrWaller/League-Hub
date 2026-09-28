import { LuckRow } from "@/lib/luck";
import TeamLogo from "@/components/TeamLogo";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (n: number, digits = 0) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
const record = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;
const toneClass = (n: number) => (n > 0 ? "text-rink" : n < 0 ? "text-center-red" : "text-muted");

export default function LuckTable({
  rows,
  leagueMedian,
  teamName,
  logos,
}: {
  rows: LuckRow[];
  leagueMedian: number;
  teamName: (id: number) => string;
  logos: Record<number, string>;
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-tabular border-collapse min-w-[720px]">
          <thead>
            <tr className="text-left text-muted border-b-2 border-rink">
              <th className="py-2 pr-3 font-body font-normal">#</th>
              <th className="py-2 pr-3 font-body font-normal">Chg</th>
              <th className="py-2 pr-4 font-body font-normal">Team</th>
              <th className="py-2 pr-4 font-body font-normal text-right">All-play</th>
              <th className="py-2 pr-4 font-body font-normal text-right">Exp win%</th>
              <th className="py-2 pr-4 font-body font-normal text-right">Actual</th>
              <th className="py-2 pr-4 font-body font-normal text-right">Act win%</th>
              <th className="py-2 pr-4 font-body font-normal text-right">Diff</th>
              <th className="py-2 pr-4 font-body font-normal text-right">Med pts/wk</th>
              <th className="py-2 font-body font-normal text-right">Med vs lg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diffPts = Math.round(r.diff * 100);
              return (
                <tr key={r.teamId} className="border-b border-ice-line/60">
                  <td className="py-3 pr-3 text-muted">{r.rank}</td>
                  <td className={`py-3 pr-3 ${r.rankChange ? toneClass(r.rankChange) : "text-muted"}`}>
                    {r.rankChange ? signed(r.rankChange) : "-"}
                  </td>
                  <td className="py-3 pr-4 font-body">
                    <div className="flex items-center gap-2">
                      <TeamLogo url={logos[r.teamId]} name={teamName(r.teamId)} size={24} />
                      {teamName(r.teamId)}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right text-muted">{record(r.allPlayW, r.allPlayL, r.allPlayT)}</td>
                  <td className="py-3 pr-4 text-right text-muted">{pct(r.expWinPct)}</td>
                  <td className="py-3 pr-4 text-right">{record(r.actW, r.actL, r.actT)}</td>
                  <td className="py-3 pr-4 text-right">{pct(r.actWinPct)}</td>
                  <td className={`py-3 pr-4 text-right font-semibold ${toneClass(diffPts)}`}>{signed(diffPts)}%</td>
                  <td className="py-3 pr-4 text-right text-muted">{r.medPts.toFixed(1)}</td>
                  <td className={`py-3 text-right font-semibold ${toneClass(r.medVsLeague)}`}>
                    {signed(r.medVsLeague, 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-3 text-right">League median = {leagueMedian.toFixed(1)}</p>
    </div>
  );
}
