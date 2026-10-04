import { NextRequest } from "next/server";
import { GET as adminGET } from "@/app/api/admin/graphics/player-radar/route";
import { publicVersion } from "@/lib/public-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public copy of @/app/api/admin/graphics/player-radar/route (see lib/public-cards.ts).
export const GET = (req: NextRequest) => publicVersion(req, adminGET);
