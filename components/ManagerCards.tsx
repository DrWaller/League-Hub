import Link from "next/link";
import TeamLogo from "./TeamLogo";
import Cup from "./Cup";

export interface ManagerCardData {
  id: number;
  name: string;
  team: string | null;
  logoUrl?: string;
  first: number | null;
  last: number | null;
  active: boolean;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  titles: number;
  hasRecord: boolean;
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export default function ManagerCards({ items }: { items: ManagerCardData[] }) {
  const active = items.filter((m) => m.active);
  const former = items.filter((m) => !m.active);
  return (
    <div className="space-y-10">
      {[["", active], ["Past managers", former]].map(([title, list]) =>
        (list as ManagerCardData[]).length === 0 ? null : (
          <section key={title as string}>
            {title && <h2 className="font-display text-xl mb-3 text-muted">{title as string}</h2>}
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(list as ManagerCardData[]).map((m) => (
                <li key={m.id}>
                  <Link href={`/managers/${m.id}`} className="group block bg-white border border-ice-line overflow-hidden hover:border-rink-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-rink-bright">
                    <div
                      className="relative h-20"
                      style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(150,180,220,0.28), transparent 60%), linear-gradient(135deg, #0C2740, #123A61)" }}
                    >
                      <span aria-hidden="true" className="absolute right-3 -bottom-3 font-display text-7xl leading-none text-white/10 select-none">{initials(m.name)}</span>
                      {m.titles > 0 && (
                        <span className="absolute right-3 top-3 flex items-center gap-1 text-gold" title={`${m.titles} title${m.titles === 1 ? "" : "s"}`}>
                          {Array.from({ length: Math.min(m.titles, 5) }).map((_, i) => <Cup key={i} size={18} />)}
                          {m.titles > 5 && <span className="font-display text-sm">+{m.titles - 5}</span>}
                        </span>
                      )}
                    </div>
                    <div className="px-4 pb-4">
                      <div className="-mt-7 mb-2 relative">
                        <span className="inline-block rounded-sm bg-white p-0.5 border border-ice-line"><TeamLogo url={m.logoUrl} name={m.team ?? m.name} size={52} /></span>
                      </div>
                      <h3 className="font-display text-2xl leading-tight group-hover:text-rink-bright">{m.name}</h3>
                      <p className="text-sm text-muted truncate">{m.team ? m.team : "No team logged yet"}</p>
                      {m.hasRecord ? (
                        <div className="mt-3">
                          <div className="flex items-baseline justify-between">
                            <span className="font-display text-xl font-tabular">{m.wins}-{m.losses}{m.ties ? `-${m.ties}` : ""}</span>
                            <span className="text-sm text-muted font-tabular">{(m.winPct * 100).toFixed(1)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 bg-ice-panel" role="img" aria-label={`Win percentage ${(m.winPct * 100).toFixed(1)}%`}>
                            <div className="h-1.5 bg-rink-bright" style={{ width: `${Math.max(2, m.winPct * 100)}%` }} />
                          </div>
                        </div>
                      ) : null}
                      {m.first != null && m.last != null && (
                        <p className="mt-2 text-xs text-muted">{m.first === m.last ? m.first : `${m.first} to ${m.last}`}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
