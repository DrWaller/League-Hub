import TradesManager from "@/components/TradesManager";

export default function AdminTradesPage() {
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Trades</h1>
      <p className="text-muted mb-8">Log player movement between managers, season by season.</p>
      <TradesManager />
    </div>
  );
}
