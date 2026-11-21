import { getDraftAssessment } from "@/lib/draft-assessment";
import { TIER_STYLE } from "@/lib/tier-style";

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
                <tr
                  key={p.overall}
                  className="border-b border-white/40"
                  style={p.tier ? { background: TIER_STYLE[p.tier].bg, color: TIER_STYLE[p.tier].fg } : undefined}
                >
                  <td className="py-1 pl-2 pr-2 opacity-80">{p.overall}</td>
                  <td className="py-1 pr-2 whitespace-nowrap">
                    {p.name} <span className="opacity-80 text-xs">{p.position}</span>
                    {p.keeper ? <span className="ml-1 text-[10px] opacity-80">K</span> : null}
                  </td>
                  <td className="py-1 pr-2 whitespace-nowrap">{p.team}</td>
                  <td className="py-1 pr-2 text-right">{f2(p.total)}</td>
                  <td className="py-1 pr-2 text-right">{f2(p.avg)}</td>
                  <td className="py-1 pr-2 text-right">{p.gp ?? "–"}</td>
                  <td className="py-1 pr-2 font-semibold">{p.tier ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
