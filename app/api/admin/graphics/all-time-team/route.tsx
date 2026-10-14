import { NextRequest } from "next/server";
import { loadAllTimeTeamCard } from "@/lib/all-time-team-card";
import { renderAllTimeTeam } from "@/lib/all-time-team-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ALL-TIME TEAM: ?managerId=N (&debug=1 for the numbers behind it).
export async function GET(req: NextRequest) {
  try {
    const managerId = Number(req.nextUrl.searchParams.get("managerId"));
    if (!managerId) return new Response("Add ?managerId=N", { status: 400 });
    const data = await loadAllTimeTeamCard(managerId);
    if (!data) return new Response("Manager not found", { status: 404 });
    if (req.nextUrl.searchParams.get("debug")) return Response.json({ ...data, logo: data.logo ? "(embedded)" : null });
    return await renderAllTimeTeam(data);
  } catch (err) {
    console.error("ALL-TIME TEAM failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
