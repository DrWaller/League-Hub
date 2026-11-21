import { getDraftAssessment } from "@/lib/draft-assessment";
import TierBadge from "@/components/TierBadge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Draft Assessment" };

const f2 = (n: number | null) => (n == null ? "–" : n.toFixed(2));

export default async function DraftAssessmentPage() {
  const data = await getDraftAssessment().catch((e) => {
    console.error("Draft assessment failed", e);
    return null;
  });
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Draft Assessment</h1>
      <p className="text-muted mb-4 max-w-prose">
        Every pick in order with the player&apos;s season total, average fantasy points per game and tier.
        {data ? ` ${data.basis}. Goalie tiers use points per team game.` : ""}
      </p>
      {!data ? (
        <p className="text-muted">No saved draft for this season yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-muted border-b border-ice-line">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Player</th>
                <th className="py-1 pr-2">Team</th>
                <th className="py-1 pr-2 text-right">Total</th>
                <th className="py-1 pr-2 text-right">Avg</th>
                <th className="py-1 pr-2 text-right">GP</th>
                <th className="py-1">Tier</th>
              </tr>
            </thead>
            <tbody>
              {data.picks.map((p) => (
                <tr key={p.overall} className="border-b border-ice-line/60">
                  <td className="py-1 pr-2 text-muted">{p.overall}</td>
                  <td className="py-1 pr-2 whitespace-nowrap">
                    {p.name} <span className="text-muted text-xs">{p.position}</span>
                    {p.keeper ? <span className="ml-1 text-[10px] text-muted">K</span> : null}
                  </td>
                  <td className="py-1 pr-2 whitespace-nowrap">{p.team}</td>
                  <td className="py-1 pr-2 text-right">{f2(p.total)}</td>
                  <td className="py-1 pr-2 text-right">{f2(p.avg)}</td>
                  <td className="py-1 pr-2 text-right">{p.gp ?? "–"}</td>
                  <td className="py-1"><TierBadge tier={p.tier} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
