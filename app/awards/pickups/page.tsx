import Link from "next/link";
import { getStandings, getLeagueMeta } from "@/lib/espn";
import { getTeamLogos } from "@/lib/content";
import { getPickupLog } from "@/lib/best-pickup";
import { addedLabel } from "@/lib/roster-moves";
import { runPickupSyncStep, getPickupCounts } from "@/lib/pickup-sync";
import TeamLogo from "@/components/TeamLogo";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Every free-agent or waiver add of the season, tracked day by day: which games he started for the team that
// added him (those count), which he sat (those don't), and when he was dropped. Best Pickup is the top of this list.
// Opening this saves one limited batch of new days (the Award Races page does the same), so it stays current.
export default async function PickupLogPage() {
  const meta = await getLeagueMeta();
  const [{ teams }, logos] = await Promise.all([getStandings(), getTeamLogos()]);
  const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  let step: Awaited<ReturnType<typeof runPickupSyncStep>> | null = null;
  try {
    step = await runPickupSyncStep();
  } catch {
    /* the table below still shows what is saved */
  }
  const counts = await getPickupCounts(meta.season);
  let log: Awaited<ReturnType<typeof getPickupLog>> = null;
  try {
    log = await getPickupLog(meta.season);
  } catch {
    /* shown as empty */
  }

  return (
    <div>
      <p className="text-sm mb-2"><Link href="/awards/races" className="text-rink underline">← Award Races</Link></p>
      <h1 className="font-display text-3xl mb-1">Pickup Log</h1>
      <p className="text-muted mb-4 max-w-prose">
        Every free-agent or waiver add this season, tracked day by day from the add until the team drops him. A game only counts if he was in the starting lineup (benched games are shown but don&apos;t count). VOR is his started points minus replacement level for each game started. Draft picks and trades are never tracked.
      </p>
      <p className="text-xs text-muted mb-4">
        {counts.pickupAdds} free-agent or waiver adds found, {counts.daysChecked} days checked.
        {step && !step.done ? " Still catching up on earlier days: reload in a moment." : ""}
        {step && step.errors.length > 0 ? ` ${step.errors.join(" ")}` : ""}
      </p>
      {log === null ? (
        <p className="text-sm text-muted">The Week Days calendar isn&apos;t saved yet, so adds can&apos;t be matched to weeks.</p>
      ) : log.length === 0 ? (
        <p className="text-sm text-muted">No pickup has played a game yet. Adds are tracked from the draft; games show once the week finishes.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-ice-line bg-white">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-ice-line">
                <th className="p-2 w-8">#</th>
                <th className="p-2">Player</th>
                <th className="p-2">Added</th>
                <th className="p-2 text-right">Start</th>
                <th className="p-2 text-right">Bench</th>
                <th className="p-2 text-right">Pts counted</th>
                <th className="p-2 text-right">Pts on bench</th>
                <th className="p-2 text-right">Avg/start</th>
                <th className="p-2 text-right">VOR</th>
              </tr>
            </thead>
            <tbody>
              {log.map((p) => (
                <tr key={`${p.teamId}-${p.playerId}`} className="border-t border-ice-line align-top">
                  <td className="p-2 font-display">{p.rank}</td>
                  <td className="p-2">
                    <div className="font-medium">{p.name} <span className="text-xs text-muted">{p.position}</span></div>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      {logos[p.teamId] ? <TeamLogo url={logos[p.teamId]} name={name(p.teamId)} size={16} /> : null}
                      {name(p.teamId)}
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {addedLabel(p.addedAt)} <span className="text-xs text-muted">({p.source.toLowerCase()})</span>
                    {p.droppedAt ? <div className="text-xs text-muted">dropped {addedLabel(p.droppedAt)}</div> : <div className="text-xs text-green-700">still rostered</div>}
                  </td>
                  <td className="p-2 text-right">{p.started}</td>
                  <td className="p-2 text-right">{p.benched}</td>
                  <td className="p-2 text-right">{pts(p.pointsCounted)}</td>
                  <td className="p-2 text-right text-muted">{pts(p.pointsBench)}</td>
                  <td className="p-2 text-right">{p.started ? pts(p.avg) : "-"}</td>
                  <td className="p-2 text-right font-bold">{p.vor >= 0 ? "+" : ""}{pts(p.vor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
