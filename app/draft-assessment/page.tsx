import { getDraftAssessment } from "@/lib/draft-assessment";
import DraftAssessmentView from "@/components/DraftAssessmentView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Draft Assessment" };

export default async function DraftAssessmentPage() {
  const data = await getDraftAssessment().catch((e) => {
    console.error("Draft assessment failed", e);
    return null;
  });
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Draft Assessment</h1>
      <p className="text-muted mb-5 max-w-prose">
        Every pick in order with the player&apos;s Season average, total and tier, the same Season tier as the Tier Lists page.
        {data ? ` ${data.basis}. Goalies are on points per team game. ${data.vorWeeks > 0 ? `Steals & Busts use season VOR through week ${data.vorWeeks}.` : "Steals & Busts need saved weekly VOR (open Award Races once to sync it)."}` : ""}
      </p>
      {data ? <DraftAssessmentView picks={data.picks} /> : <p className="text-muted">No saved draft for this season yet.</p>}
    </div>
  );
}
