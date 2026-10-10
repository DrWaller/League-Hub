import SeasonHistoryEditor from "@/components/SeasonHistoryEditor";

export const dynamic = "force-dynamic";

export default function AdminHistoryPage() {
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">League History</h1>
      <p className="text-muted mb-8 max-w-prose">
        Record who won each season and add notes on the odd ones. Final standings fill in on their
        own from ESPN.
      </p>
      <SeasonHistoryEditor />
    </div>
  );
}
