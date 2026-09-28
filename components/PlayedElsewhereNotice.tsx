import Link from "next/link";

// Shown instead of ESPN data when someone opens a season that was played on
// another platform (e.g. by typing ?season=2025 into the address).
export default function PlayedElsewhereNotice({ season }: { season: number }) {
  return (
    <div className="border border-ice-line bg-ice-panel p-5 max-w-prose">
      <p className="font-body font-medium mb-1">{season} was played on Fantrax.</p>
      <p className="text-sm text-muted mb-3">
        There&apos;s no ESPN data for that season here on purpose, so it can&apos;t affect anyone&apos;s
        records. Its champion and notes are on the League History page.
      </p>
      <Link href="/history" className="text-sm text-rink hover:underline">
        Go to League History
      </Link>
    </div>
  );
}
