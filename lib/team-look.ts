// Hand-set looks for a few teams whose saved colours don't match their logo. The saved main colour is replaced and a
// gold-style accent is added, used for the outline and highlights on the manager card and the all-time team graphic.
// Matching is by manager or team name so it follows the person even if the team ID changes.

interface Override {
  primary: string;
  accent: string;
}

const OVERRIDES: { match: (manager: string, team: string | null) => boolean; look: Override }[] = [
  {
    // Vinny: crimson hair, gold outlines and a navy coat.
    match: (manager, team) => manager.trim().toLowerCase() === "vinny" || /reinhart of the cards/i.test(team ?? ""),
    look: { primary: "#B3132F", accent: "#F2B531" },
  },
];

export function teamLookOverride(manager: string, team: string | null): Override | null {
  return OVERRIDES.find((o) => o.match(manager, team))?.look ?? null;
}
