import { NextResponse } from "next/server";
import { getStandings } from "@/lib/espn";

export async function GET() {
  const { teams } = await getStandings();
  return NextResponse.json(teams.map((t) => ({ id: t.id, name: t.name })));
}
