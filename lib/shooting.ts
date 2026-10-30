// Server-side only. Shooting percentage baselines from the NHL's public stats API (api.nhle.com), the same source
// as lib/nhl-usage.ts: goals and shots over the three completed seasons before this one, and over every earlier
// season (career before this season). One small request per player and range, cached for a day.

export interface ShootingLine {
  goals: number;
  shots: number;
  gp: number;
}
export interface ShootingBaseline {
  y3: ShootingLine | null; // the three seasons before this one
  career: ShootingLine | null; // every season before this one
}

const seasonId = (endYear: number) => `${endYear - 1}${endYear}`; // 2026 -> 20252026

async function aggregate(nhlId: number, range: string): Promise<ShootingLine | null> {
  const exp = `gameTypeId=2 and playerId=${nhlId} and ${range}`;
  const url = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=false&limit=-1&cayenneExp=${encodeURIComponent(exp)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.error("Shooting baseline failed", nhlId, res.status);
      return null;
    }
    const data = await res.json();
    const row = (data?.data ?? [])[0];
    if (!row) return null;
    const shots = Number(row.shots);
    const goals = Number(row.goals);
    if (!Number.isFinite(shots) || !Number.isFinite(goals) || shots <= 0) return null;
    return { goals, shots, gp: Number(row.gamesPlayed) || 0 };
  } catch (err) {
    console.error("Shooting baseline error", nhlId, err);
    return null;
  }
}

// `season` is the fantasy season's end year (2027 = 2026-27). Results are keyed by NHL player id.
export async function getShootingBaselines(season: number, nhlIds: number[]): Promise<Record<number, ShootingBaseline>> {
  const lastDone = seasonId(season - 1); // the most recent completed season
  const firstOf3 = seasonId(season - 3);
  const ids = Array.from(new Set(nhlIds));
  const out: Record<number, ShootingBaseline> = {};
  await Promise.all(
    ids.map(async (id) => {
      const [y3, career] = await Promise.all([aggregate(id, `seasonId>=${firstOf3} and seasonId<=${lastDone}`), aggregate(id, `seasonId<=${lastDone}`)]);
      out[id] = { y3, career };
    })
  );
  return out;
}
