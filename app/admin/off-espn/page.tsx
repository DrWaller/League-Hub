import OffEspnEditor from "@/components/OffEspnEditor";

export const dynamic = "force-dynamic";

export default function OffEspnPage() {
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Fantrax Season Scores</h1>
      <p className="text-muted mb-8 max-w-prose">
        Enter the weekly scores for a season that wasn&apos;t played on ESPN. The site works out its standings, Matchups and
        Luck Chart from them, and the Records page counts them toward all-time totals.
      </p>
      <OffEspnEditor />
    </div>
  );
}
