import { getDraftAssessment } from "@/lib/draft-assessment";
import { getLeagueMeta } from "@/lib/espn";
import { renderDraftGradeCards } from "@/lib/draft-card-image";
import { draftGrades } from "@/lib/draft-teams";
import { seasonFooter } from "@/lib/portrait-graphics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Public (no login) graphic: every team's draft ranked and graded.
export async function GET() {
  try {
    const [data, meta] = await Promise.all([getDraftAssessment(), getLeagueMeta()]);
    if (!data) return new Response("No saved draft for this season yet.", { status: 404 });
    const grades = draftGrades(data.picks);
    if (grades.length === 0) return new Response("No draft picks to grade.", { status: 404 });
    return await renderDraftGradeCards({ grades, footer: seasonFooter(meta.name, meta.season) });
  } catch (err) {
    console.error("Draft grades graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
