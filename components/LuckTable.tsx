import { LuckRow, luckColor, luckExtremes, luckTint } from "@/lib/luck";
import TeamLogo from "@/components/TeamLogo";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (n: number, digits = 0) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
const record = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;

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
  const { luckiest, unluckiest } = luckExtremes(rows);

  return (
    <div>
      {(luckiest || unluckiest) && (
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {luckiest && (
            <div className="border p-4" style={{ borderColor: luckColor(1), background: luckTint(0.12) }}>
              <div className="text-xs uppercase tracking-wide" style={{ color: luckColor(1) }}>
                Luckiest
              </div>
              <div className="font-display text-lg leading-tight">{teamName(luckiest.teamId)}</div>
              <div className="text-sm text-muted font-tabular">
                {signed(Math.round(luckiest.diff * 100))}% — actual {pct(luckiest.actWinPct)} vs. expected{" "}
                {pct(luckiest.expWinPct)}
              </div>
            </div>
          )}
          {unluckiest && (
            <div className="border p-4" style={{ borderColor: luckColor(-1), background: luckTint(-0.12) }}>
              <div className="text-xs uppercase tracking-wide" style={{ color: luckColor(-1) }}>
                Unluckiest
              </div>
              <div className="font-display text-lg leading-tight">{teamName(unluckiest.teamId)}</div>
              <div className="text-sm text-muted font-tabular">
                {signed(Math.round(unluckiest.diff * 100))}% — actual {pct(unluckiest.actWinPct)} vs. expected{" "}
                {pct(unluckiest.expWinPct)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm font-tabular border-collapse sm:min-w-[720px]">
          <thead>
            <tr className="text-left text-muted border-b-2 border-rink">
              <th className="py-2 pr-3 font-body font-normal">#</th>
              <th className="hidden sm:table-cell py-2 pr-3 font-body font-normal">Chg</th>
              <th className="py-2 pr-4 font-body font-normal">Team</th>
              <th className="hidden sm:table-cell py-2 px-3 font-body font-normal text-center">All-play</th>
              <th className="py-2 px-3 font-body font-normal text-center">Exp win%</th>
              <th className="py-2 px-3 font-body font-normal text-center">Actual</th>
              <th className="hidden sm:table-cell py-2 px-3 font-body font-normal text-center">Act win%</th>
              <th className="py-2 px-3 font-body font-normal text-center">Luck</th>
              <th className="hidden sm:table-cell py-2 px-3 font-body font-normal text-center">Med pts/wk</th>
              <th className="hidden sm:table-cell py-2 px-3 font-body font-normal text-center">Med vs lg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diffPts = Math.round(r.diff * 100);
              return (
                <tr key={r.teamId} className="border-b border-ice-line/60">
                  <td className="py-3 pr-3 text-muted">{r.rank}</td>
                  <td className="hidden sm:table-cell py-3 pr-3 text-muted">{r.rankChange ? signed(r.rankChange) : "-"}</td>
                  <td className="py-3 pr-4 font-body">
                    <div className="flex items-center gap-2">
                      <TeamLogo url={logos[r.teamId]} name={teamName(r.teamId)} size={24} />
                      {teamName(r.teamId)}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell py-3 px-3 text-center text-muted">{record(r.allPlayW, r.allPlayL, r.allPlayT)}</td>
                  <td className="py-3 px-3 text-center text-muted">{pct(r.expWinPct)}</td>
                  <td className="py-3 px-3 text-center">{record(r.actW, r.actL, r.actT)}</td>
                  <td className="hidden sm:table-cell py-3 px-3 text-center">{pct(r.actWinPct)}</td>
                  {/* Luck cell: green = lucky, red = unlucky, shaded by size of the gap */}
                  <td
                    className="py-3 px-3 text-center font-semibold"
                    style={{ color: luckColor(r.diff), background: luckTint(r.diff) }}
                  >
                    {signed(diffPts)}%
                  </td>
                  <td className="hidden sm:table-cell py-3 px-3 text-center text-muted">{r.medPts.toFixed(2)}</td>
                  <td className="hidden sm:table-cell py-3 px-3 text-center font-semibold">{signed(r.medVsLeague, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-3 text-right">League median = {leagueMedian.toFixed(2)}</p>
    </div>
  );
}
