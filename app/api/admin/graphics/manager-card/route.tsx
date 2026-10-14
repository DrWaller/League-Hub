import { NextRequest } from "next/server";
import { loadManagerCard } from "@/lib/manager-card";
import { renderManagerCard } from "@/lib/manager-card-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MANAGER CARD: ?managerId=N (&debug=1 for the numbers behind it).
export async function GET(req: NextRequest) {
  try {
    const managerId = Number(req.nextUrl.searchParams.get("managerId"));
    if (!managerId) return new Response("Add ?managerId=N", { status: 400 });
    const data = await loadManagerCard(managerId);
    if (!data) return new Response("Manager not found", { status: 404 });
    if (req.nextUrl.searchParams.get("debug")) return Response.json({ ...data, logo: data.logo ? "(embedded)" : null });
    return await renderManagerCard(data);
  } catch (err) {
    console.error("MANAGER CARD failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
