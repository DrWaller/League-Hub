import { getDraftAssessment, type AssessedPick } from "@/lib/draft-assessment";
import { TIER_STYLE, TIERS } from "@/lib/tier-style";

export const dynamic = "force-dynamic";
export const metadata = { title: "Draft Assessment" };

const f2 = (n: number | null) => (n == null ? "–" : n.toFixed(2));

// One compact card per pick: pick number, player and team, then tier / avg / total on the right. No sideways scrolling.
function PickRow({ p }: { p: AssessedPick }) {
  const s = p.tier ? TIER_STYLE[p.tier] : { bg: "#E6EBF1", fg: "#0C2740" };
  return (
    <li className="grid grid-cols-[2.1rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2.5 py-1.5 shadow-sm" style={{ background: s.bg, color: s.fg }}>
      <span className="text-sm font-semibold tabular-nums opacity-80">{p.overall}</span>
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold leading-tight">
          {p.name} <span className="text-[11px] font-medium opacity-75">{p.position}</span>
        </div>
        <div className="truncate text-[12px] leading-tight opacity-80">{p.team}</div>
      </div>
      <div className="text-right tabular-nums leading-tight">
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">{p.tier ?? "–"}</div>
        <div className="text-lg font-bold leading-none">{f2(p.avg)}</div>
        <div className="text-[11px] opacity-85">
          {f2(p.total)} pts · {p.gp ?? "–"} GP
        </div>
      </div>
    </li>
  );
}

export default async function DraftAssessmentPage() {
  const data = await getDraftAssessment().catch((e) => {
    console.error("Draft assessment failed", e);
    return null;
  });
  if (!data) {
    return (
      <div>
        <h1 className="font-display text-3xl mb-1">Draft Assessment</h1>
        <p className="text-muted">No saved draft for this season yet.</p>
      </div>
    );
  }

  const counts = TIERS.map((t) => ({ t, n: data.picks.filter((p) => !p.keeper && p.tier === t).length }));
  const drafted = data.picks.filter((p) => !p.keeper);
  const keepers = data.picks.filter((p) => p.keeper);
  const rounds = new Map<number, AssessedPick[]>();
  for (const p of drafted) {
    const r = p.round ?? Math.ceil(p.overall / 10);
    rounds.set(r, [...(rounds.get(r) ?? []), p]);
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="font-display text-3xl mb-1">Draft Assessment</h1>
      <p className="text-muted text-sm mb-3">
        Every pick in order: avg fantasy pts per game (big), season total and games played. {data.basis}. Goalie tiers use points per team game.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-5" aria-label="Drafted picks by tier">
        {counts.map(({ t, n }) => (
          <span key={t} className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: TIER_STYLE[t].bg, color: TIER_STYLE[t].fg }}>
            {t} {n}
          </span>
        ))}
      </div>

      {Array.from(rounds.entries()).map(([r, picks]) => (
        <section key={r} className="mb-4">
          <h2 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">Round {r}</h2>
          <ul className="space-y-1">{picks.map((p) => <PickRow key={p.overall} p={p} />)}</ul>
        </section>
      ))}

      {keepers.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">Keepers</h2>
          <ul className="space-y-1">{keepers.map((p) => <PickRow key={p.overall} p={p} />)}</ul>
        </section>
      )}
    </div>
  );
}
