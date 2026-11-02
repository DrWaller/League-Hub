import { NextRequest } from "next/server";
import { GET as adminGET } from "@/app/api/admin/graphics/award-race/route";
import { publicVersion } from "@/lib/public-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Public copy of @/app/api/admin/graphics/award-race/route (see lib/public-cards.ts).
export const GET = (req: NextRequest) => publicVersion(req, adminGET);
