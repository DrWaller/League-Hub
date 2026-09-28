import { NextRequest, NextResponse } from "next/server";
import { getLeagueMeta, getPastSeasons, getPastSeasonTeams } from "@/lib/espn";
import {
  getManagers,
  getManagerSeasons,
  getManualSeasons,
  getManualSeasonData,
  getPlayedElsewhereSeasons,
  assignManagerToTeamSeason,
  clearManagerFromTeamSeason,
  setManualTeamManager,
} from "@/lib/content";

export const dynamic = "force-dynamic";

type Source = "espn" | "manual";
interface TeamRow {
  id: number;
  name: string;
  managerId: number | null;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

// Every season whose teams can be linked: ESPN's seasons, plus any season
// entered by hand (the Fantrax year). Newest first.
async function seasonList(): Promise<{ season: number; source: Source }[]> {
  const meta = await getLeagueMeta();
  const [past, elsewhere, manual] = await Promise.all([getPastSeasons(meta.season), getPlayedElsewhereSeasons(), getManualSeasons()]);
  const espn = past.filter((s) => !elsewhere.has(s)).map((season) => ({ season, source: "espn" as Source }));
  return [...espn, ...manual.map((season) => ({ season, source: "manual" as Source }))].sort((a, b) => b.season - a.season);
}

async function teamsFor(season: number, source: Source, managerSeasons: Awaited<ReturnType<typeof getManagerSeasons>>): Promise<TeamRow[]> {
  if (source === "manual") {
    return (await getManualSeasonData(season)).teams.map((t) => ({ id: t.id, name: t.name, managerId: t.managerId })).sort((a, b) => a.name.localeCompare(b.name));
  }
  const teams = (await getPastSeasonTeams(season)) ?? [];
  return teams
    .map((t) => ({ id: t.id, name: t.name, managerId: managerSeasons.find((m) => m.season === season && m.teamId === t.id)?.managerId ?? null }))
    .sort((a, b) => a.id - b.id);
}

export async function GET(req: NextRequest) {
  const [seasons, managers, managerSeasons] = await Promise.all([seasonList(), getManagers(), getManagerSeasons()]);
  const perSeason = await Promise.all(seasons.map(async (s) => ({ ...s, teams: await teamsFor(s.season, s.source, managerSeasons) })));
  const wanted = Number(req.nextUrl.searchParams.get("season"));
  const selected = perSeason.find((s) => s.season === wanted) ?? perSeason[0] ?? null;
  return NextResponse.json({
    managers: [...managers].sort((a, b) => a.name.localeCompare(b.name)),
    seasons: perSeason.map((s) => ({ season: s.season, source: s.source, total: s.teams.length, unlinked: s.teams.filter((t) => !t.managerId).length })),
    selected: selected && { season: selected.season, source: selected.source, teams: selected.teams },
  });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const season = Number(b.season);
  if (!season) return NextResponse.json({ error: "season is required" }, { status: 400 });

  const list = await seasonList();
  const source = list.find((s) => s.season === season)?.source;
  if (!source) return NextResponse.json({ error: "That season isn't available to link." }, { status: 400 });
  const managerSeasons = await getManagerSeasons();

  // Link (or un-link) one team in this season.
  if (b.action === "set") {
    const teamId = Number(b.teamId);
    const managerId = b.managerId ? Number(b.managerId) : null;
    if (source === "manual") {
      await setManualTeamManager(teamId, managerId);
    } else if (managerId) {
      const team = (await teamsFor(season, source, managerSeasons)).find((t) => t.id === teamId);
      if (!team) return NextResponse.json({ error: "Team not found in that season." }, { status: 400 });
      await assignManagerToTeamSeason(managerId, teamId, season, team.name);
    } else {
      await clearManagerFromTeamSeason(teamId, season);
    }
    return NextResponse.json({ ok: true });
  }

  // Copy last year's links onto this year's still-unlinked teams (same team slot).
  if (b.action === "copyFrom" && source === "espn") {
    const from = Number(b.fromSeason);
    const mine = await teamsFor(season, source, managerSeasons);
    let linked = 0;
    for (const t of mine) {
      if (t.managerId) continue;
      const prev = managerSeasons.find((m) => m.season === from && m.teamId === t.id)?.managerId;
      if (prev) {
        await assignManagerToTeamSeason(prev, t.id, season, t.name);
        linked++;
      }
    }
    return NextResponse.json({ ok: true, linked });
  }

  // Use this team's manager for every other ESPN season where that team slot is still unlinked.
  if (b.action === "fillOtherYears" && source === "espn") {
    const teamId = Number(b.teamId);
    const managerId = managerSeasons.find((m) => m.season === season && m.teamId === teamId)?.managerId;
    if (!managerId) return NextResponse.json({ error: "Link this team first." }, { status: 400 });
    let linked = 0;
    for (const s of list.filter((x) => x.source === "espn" && x.season !== season)) {
      const t = (await teamsFor(s.season, s.source, managerSeasons)).find((x) => x.id === teamId);
      if (t && !t.managerId) {
        await assignManagerToTeamSeason(managerId, teamId, s.season, t.name);
        linked++;
      }
    }
    return NextResponse.json({ ok: true, linked });
  }

  // Hand-entered season: link any team whose name is exactly a manager's name.
  if (b.action === "autoByName" && source === "manual") {
    const managers = await getManagers();
    let linked = 0;
    for (const t of await teamsFor(season, source, managerSeasons)) {
      if (t.managerId) continue;
      const m = managers.find((x) => norm(x.name) === norm(t.name));
      if (m) {
        await setManualTeamManager(t.id, m.id);
        linked++;
      }
    }
    return NextResponse.json({ ok: true, linked });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
