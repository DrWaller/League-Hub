import { NextRequest } from "next/server";
import { GET as adminGET } from "@/app/api/admin/graphics/all-time-team/route";
import { publicVersion } from "@/lib/public-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public copy of @/app/api/admin/graphics/all-time-team/route (see lib/public-cards.ts).
export const GET = (req: NextRequest) => publicVersion(req, adminGET);
