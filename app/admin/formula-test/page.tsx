import { getLeagueMeta } from "@/lib/espn";
import { getHistorySeasons } from "@/lib/seasons";
import { getSeasonBundle } from "@/lib/season-data";
import {
  buildSamples,
  evaluate,
  gridSearch,
  holdoutTest,
  CANDIDATES,
  FEAT_LABEL,
  Feat,
  SeasonInput,
  Weights,
} from "@/lib/formula-test";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const describe = (w: Weights) =>
  Object.entries(w)
    .filter(([, v]) => (v ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([k, v]) => `${FEAT_LABEL[k as Feat]} ${Math.round((v ?? 0) * 100)}`)
    .join(" / ");

export default async function FormulaTestPage() {
  const meta = await getLeagueMeta();
  const available = (await getHistorySeasons(meta.season)).filter((s) => s !== meta.season);
  const bundles = await Promise.all(available.map((s) => getSeasonBundle(s)));

  const seasons: SeasonInput[] = [];
  bundles.forEach((b, i) => {
    if (b && b.matchups.length > 0) seasons.push({ season: available[i], matchups: b.matchups });
  });

  const samples = buildSamples(seasons);
  const total = samples.reduce((n, s) => n + s.games.length, 0);
  const margin = total > 0 ? 1.96 * Math.sqrt(0.25 / total) : 0;

  const results = CANDIDATES.map((c) => ({ ...c, acc: evaluate(samples, c.weights) })).sort((a, b) => b.acc.pct - a.acc.pct);
  const grid = total > 0 ? gridSearch(samples).slice(0, 5) : [];
  const holdout = holdoutTest(seasons);
  const current = results.find((r) => r.name.startsWith("Current"));

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Power Rankings Formula Test</h1>
      <p className="text-muted mb-6 max-w-prose">
        For every week of every finished season, each formula ranks the teams using only the games played
        <em> before</em> that week, then gets scored on how often the higher-ranked team won that week&apos;s matchup.
        A coin flip is 50%.
      </p>

      {total === 0 ? (
        <p className="text-muted">No usable past seasons found (need weekly scores for at least one finished season).</p>
      ) : (
        <>
          <p className="text-sm mb-6">
            {seasons.length} seasons ({seasons.map((s) => s.season).sort().join(", ")}), {total} matchups tested. With
            this many games, differences smaller than about <b>±{(margin * 100).toFixed(1)} points</b> are noise.
          </p>

          <div className="overflow-x-auto mb-10">
            <table className="w-full text-sm font-tabular border-collapse">
              <thead>
                <tr className="text-left text-muted border-b-2 border-rink">
                  <th className="py-2 pr-4 font-body font-normal">Formula</th>
                  <th className="py-2 pr-4 font-body font-normal text-right">Overall</th>
                  <th className="py-2 pr-4 font-body font-normal text-right">Weeks 2-4</th>
                  <th className="py-2 font-body font-normal text-right">Week 5+</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.name} className="border-b border-ice-line">
                    <td className="py-3 pr-4">{r.name}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{pct(r.acc.pct)}</td>
                    <td className="py-3 pr-4 text-right text-muted">{pct(r.acc.early.pct)}</td>
                    <td className="py-3 text-right text-muted">{pct(r.acc.late.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="font-display text-2xl mb-2">Best blends found</h2>
          <p className="text-sm text-muted mb-4 max-w-prose">
            Every mix of all-play, points scored, last-3 scoring, win % and streak in quarter steps. The top of any
            search like this looks better than it really is, so the honest check below matters more than these numbers.
          </p>
          <ul className="text-sm space-y-1 mb-8">
            {grid.map((g, i) => (
              <li key={i}>
                <span className="font-tabular font-semibold">{pct(g.acc.pct)}</span> — {describe(g.weights)}
              </li>
            ))}
          </ul>

          {holdout && (
            <div className="border border-ice-line p-5 max-w-prose">
              <h2 className="font-display text-lg mb-1">Honest check (out-of-sample)</h2>
              <p className="text-sm text-muted mb-3">
                Picked the best blend using half the seasons, then scored it on the other half it never saw (and the
                reverse).
              </p>
              <p className="text-sm">
                Best-blend method: <b>{pct(holdout.best)}</b> · Current formula on the same games: <b>{pct(holdout.current)}</b> ({holdout.n}{" "}
                games)
              </p>
            </div>
          )}

          {current && (
            <p className="text-xs text-muted mt-6 max-w-prose">
              Send this page&apos;s numbers to Claude and the formula can be updated to whatever holds up. Nothing here
              changes the live rankings.
            </p>
          )}
        </>
      )}
    </div>
  );
}
