import PlayerCardsBrowser from "@/components/PlayerCardsBrowser";

export const metadata = { title: "Player Cards" };

export default function PlayersPage() {
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Player Cards</h1>
      <p className="text-muted mb-6 max-w-prose">
        Pick any NHL player and see how he stacks up in our league&apos;s scoring categories: a percentile radar, percentile bars, and fantasy points
        ranks. Search by name, choose from a team&apos;s roster, or browse the rankings. Previous seasons are available too.
      </p>
      <PlayerCardsBrowser graphicsBase="/api/cards" playersBase="/api/players" fresh={false} />
    </div>
  );
}
