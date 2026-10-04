import PlayerCardsBrowser from "@/components/PlayerCardsBrowser";

export default function PlayerCardsPage() {
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Player Cards</h1>
      <p className="text-muted mb-6 max-w-prose">Pick a player and all of their cards are generated below. Search any NHL player by name, or choose one from a fantasy team&apos;s roster. The same page is public at /players.</p>
      <PlayerCardsBrowser graphicsBase="/api/admin/graphics" playersBase="/api/admin/players" fresh />
    </div>
  );
}
