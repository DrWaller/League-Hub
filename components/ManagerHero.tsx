import TeamLogo from "./TeamLogo";
import Cup from "./Cup";

export interface ManagerHeroData {
  name: string;
  team: string | null;
  logoUrl?: string;
  first: number | null;
  last: number | null;
  notes: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  titles: number;
  runnerUps: number;
  seasons: number;
  hasRecord: boolean;
}

// The top of a manager's page: dark like the banner rafters below it, with the career record as the one big number.
export default function ManagerHero({ d }: { d: ManagerHeroData }) {
  return (
    <header
      className="rounded-md border border-board px-5 sm:px-8 py-7 mb-6 text-ice"
      style={{
        background:
          "radial-gradient(ellipse at 12% -30%, rgba(150,180,220,0.30), transparent 55%), radial-gradient(ellipse at 95% 0%, rgba(217,164,65,0.18), transparent 45%), linear-gradient(#0a0e13, #18212e)",
      }}
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
        <div className="flex items-center gap-4 min-w-0 flex-1 basis-72">
          <span className="rounded-sm bg-white/90 p-0.5 shrink-0"><TeamLogo url={d.logoUrl} name={d.team ?? d.name} size={72} /></span>
          <div className="min-w-0">
            <h1 className="font-display text-4xl sm:text-5xl leading-none break-words">{d.name}</h1>
            <p className="mt-1.5 text-ice/70 truncate">
              {d.team ? `${d.team}` : "No team logged yet"}
              {d.first != null && d.last != null ? `, ${d.first === d.last ? d.first : `${d.first} to ${d.last}`}` : ""}
            </p>
            {d.notes && <p className="mt-1 text-sm text-ice/55 max-w-prose">{d.notes}</p>}
          </div>
        </div>
        {d.hasRecord && (
          <div className="flex items-end gap-5 sm:gap-6">
            <div>
              <p className="font-display text-4xl sm:text-6xl leading-none font-tabular whitespace-nowrap">
                {d.wins}-{d.losses}
                {d.ties ? `-${d.ties}` : ""}
              </p>
              <p className="mt-1.5 text-sm text-ice/65">
                {(d.winPct * 100).toFixed(1)}% over {d.seasons} season{d.seasons === 1 ? "" : "s"}
              </p>
            </div>
            {(d.titles > 0 || d.runnerUps > 0) && (
              <div className="border-l border-white/15 pl-6">
                <p className="flex items-center gap-1.5 text-gold">
                  <Cup size={26} />
                  <span className="font-display text-4xl leading-none">{d.titles}</span>
                </p>
                <p className="mt-1.5 text-sm text-ice/65">{d.titles === 1 ? "title" : "titles"}{d.runnerUps > 0 ? `, ${d.runnerUps} runner-up` : ""}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
