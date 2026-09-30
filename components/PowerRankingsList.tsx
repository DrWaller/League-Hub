import { Team, PowerRankingEntry } from "@/lib/types";
import TeamLogo from "@/components/TeamLogo";

// Up/down arrow with the number of places moved since last week.
function Movement({ change }: { change: number }) {
  if (change === 0) return <span className="text-xs text-muted w-10 text-right">—</span>;
  const up = change > 0;
  return (
    <span
      className="text-xs font-tabular w-10 text-right font-semibold"
      style={{ color: up ? "#1F7A4D" : "#C41E3A" }}
      title={`${up ? "Up" : "Down"} ${Math.abs(change)} since last week`}
    >
      {up ? "▲" : "▼"} {Math.abs(change)}
    </span>
  );
}

// The ranked list used on the Power Rankings page and in the newsletter.
export default function PowerRankingsList({
  rankings,
  teams,
  logos,
}: {
  rankings: PowerRankingEntry[];
  teams: Team[];
  logos: Record<number, string>;
}) {
  return (
    <ol className="space-y-2">
      {rankings.map((r) => {
        const team = teams.find((t) => t.id === r.teamId);
        if (!team) return null;
        return (
          <li key={r.teamId} className="flex items-center justify-between border border-ice-line px-5 py-4">
            <div className="flex items-center gap-4">
              <span className="w-8 h-8 rounded-full bg-rink text-ice flex items-center justify-center font-display">
                {r.rank}
              </span>
              <TeamLogo url={logos[team.id]} name={team.name} size={32} />
              <div>
                <div className="font-body font-medium">{team.name}</div>
                <div className="text-xs text-muted">
                  {team.wins}-{team.losses}
                  {team.ties ? `-${team.ties}` : ""} · {team.streak ?? "—"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {r.previousRank != null && <Movement change={r.previousRank - r.rank} />}
              <div className="font-tabular text-lg">{r.score.toFixed(2)}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
