import SeasonRulesEditor from "@/components/SeasonRulesEditor";

export const dynamic = "force-dynamic";

export default function SeasonRulesPage() {
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Playoffs & Games That Don&apos;t Count</h1>
      <p className="text-muted mb-8 max-w-prose">
        For each past season, say which week the playoffs began and mark any games that shouldn&apos;t count. Standings, the Luck
        Chart, and the Records page all follow what you set here.
      </p>
      <SeasonRulesEditor />
    </div>
  );
}
