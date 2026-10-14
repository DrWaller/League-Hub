// Hand-set looks for teams whose saved colours don't match their logo. Each graphic has three colour roles: the main
// colour (header), an accent (outline and highlights) and a panel colour (the dark behind the lineup). Anything left out
// falls back to the saved colour, a tint of it, or navy. Matching is by manager or team name so it follows
// the person even if the team ID changes.

export interface TeamLook {
  primary?: string;
  accent?: string;
  panel?: string;
}

const OVERRIDES: { match: (manager: string, team: string | null) => boolean; look: TeamLook }[] = [
  {
    // Vinny: crimson hair, gold outlines and a navy coat.
    match: (manager, team) => manager.trim().toLowerCase() === "vinny" || /reinhart of the cards/i.test(team ?? ""),
    look: { primary: "#B3132F", accent: "#F2B531", panel: "#10243B" },
  },
  {
    // Bobby: a black and orange logo, so charcoal panels instead of navy.
    match: (manager) => manager.trim().toLowerCase() === "bobby",
    look: { accent: "#FF7A1A", panel: "#1B1D22" },
  },
  {
    // Dan: red, black and gold Senators logo, so gold highlights on charcoal.
    match: (manager) => manager.trim().toLowerCase() === "dan",
    look: { accent: "#EDB325", panel: "#1B1D22" },
  },
  {
    // Matt: a red and white logo, so white highlights on charcoal (navy didn't suit it).
    match: (manager) => manager.trim().toLowerCase() === "matt",
    look: { accent: "#FFFFFF", panel: "#1B1D22" },
  },
];

export function teamLookOverride(manager: string, team: string | null): TeamLook | null {
  return OVERRIDES.find((o) => o.match(manager, team))?.look ?? null;
}
