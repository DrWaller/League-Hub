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
  {
    // Dave: a royal blue and white raccoon on a blue maple leaf; a near-black navy behind the lineup so it doesn't blend with the header.
    match: (manager) => manager.trim().toLowerCase() === "dave",
    look: { primary: "#0B3A8F", accent: "#FFFFFF", panel: "#0A0F1C" },
  },
  {
    // Calder: a royal blue H with a golden-orange bagel, so bagel-orange highlights on a blue-black panel.
    match: (manager) => manager.trim().toLowerCase() === "calder",
    look: { primary: "#0853CC", accent: "#E8913F", panel: "#050B1C" },
  },
  {
    // Richard: gold and black, so charcoal panels (gold highlights come from his team colour).
    match: (manager) => manager.trim().toLowerCase() === "richard",
    look: { panel: "#1B1D22" },
  },
  {
    // Tim: the Swedish flag's yellow and blue, taken from his logo.
    match: (manager) => manager.trim().toLowerCase() === "tim",
    look: { primary: "#2C6AA6", accent: "#FDDE03", panel: "#08142A" },
  },
  {
    // Evan: teal header with the gold of the crossed sticks in his logo for the outline and highlights.
    match: (manager) => manager.trim().toLowerCase() === "evan",
    look: { accent: "#F4B82A" },
  },
];

export function teamLookOverride(manager: string, team: string | null): TeamLook | null {
  return OVERRIDES.find((o) => o.match(manager, team))?.look ?? null;
}
