// Shared color tokens for generated graphics -- same palette as the site
// itself (see tailwind.config.js), kept as plain hex since Satori doesn't
// read CSS custom properties or Tailwind classes.

export const OG = {
  ice: "#F3F6FA",
  icePanel: "#E6ECF3",
  iceLine: "#CBD6E2",
  rink: "#123A61",
  rinkDeep: "#0C2740",
  centerRed: "#C41E3A",
  board: "#14181D",
  muted: "#5B6672",
  gold: "#D9A441",
  silver: "#8A94A0",
  bronze: "#A0673D",
  // Darker versions of the medal colors for SMALL TEXT on white (the plain
  // ones are fine for borders and fills but too light to read as text).
  goldText: "#9A6B12",
  silverText: "#5B6877",
  bronzeText: "#8A5A36",
};

export const OG_WIDTH = 1200;

// Team colors (taken from each team's logo), keyed by ESPN team id. Used for the big-night
// banner and the thin accent along the bottom of player cards. A team that isn't listed gets
// no accent (cards) or the site navy (banner) -- add its id here to give it one.
export const TEAM_COLOR: Record<number, string> = {
  1: "#034946", // Mighty Tkachuks
  2: "#215070", // Hagel and Cream Cheese
  5: "#C11C2C", // DANtastic SENSations
  7: "#51287E", // Carter's Club
  9: "#D61C18", // Randy's 18-Wheelers
  10: "#1B2554", // Reinhart of the Cards
};

// next/og tells browsers to cache every image for a YEAR ("immutable"), so a graphic you have
// already opened (same player, same week) would keep showing the old picture even after new
// stats or a redeploy. These graphics are made fresh each time, so say so.
export const NO_CACHE = { "cache-control": "no-store, max-age=0" };
