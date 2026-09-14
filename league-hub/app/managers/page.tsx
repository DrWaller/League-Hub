import Link from "next/link";
import { getManagers, getManagerSeasons } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function ManagersPage() {
  const [managers, seasons] = await Promise.all([getManagers(), getManagerSeasons()]);

  const rows = managers
    .map((m) => {
      const mySeasons = seasons.filter((s) => s.managerId === m.id).sort((a, b) => b.season - a.season);
      return { manager: m, seasons: mySeasons };
    })
    .sort((a, b) => (b.seasons[0]?.season ?? 0) - (a.seasons[0]?.season ?? 0));

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Managers</h1>
      <p className="text-muted mb-8">The people behind the teams, across every rename.</p>

      {rows.length === 0 ? (
        <p className="text-muted">No managers added yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {rows.map(({ manager, seasons }) => (
            <Link
              key={manager.id}
              href={`/managers/${manager.id}`}
              className="border border-ice-line p-5 hover:border-rink-bright transition-colors"
            >
              <h2 className="font-display text-lg mb-1">{manager.name}</h2>
              <p className="text-sm text-muted">
                {seasons.length > 0
                  ? `${seasons[seasons.length - 1].season}–${seasons[0].season} · currently "${seasons[0].teamName}"`
                  : "No seasons logged yet"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
