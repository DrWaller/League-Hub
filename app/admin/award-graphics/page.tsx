import AwardRaceGraphics from "@/components/AwardRaceGraphics";

export const dynamic = "force-dynamic";

export default function AwardGraphicsPage() {
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Award Race Graphics</h1>
      <p className="text-muted mb-1 max-w-prose">One portrait graphic for each season-long award race, with a caption you can copy.</p>
      <p className="text-sm text-muted mb-6 max-w-prose">
        Each one is only made when you press its button, so this page uses no server time until you ask. The graphics read the numbers already saved: open Award Races (or Season Awards) once after a week finishes to refresh them.
      </p>
      <AwardRaceGraphics />
    </div>
  );
}
