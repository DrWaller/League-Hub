// NHL team names and colours (primary, secondary) for the hockey card. Keyed by the abbreviations ESPN and the
// NHL use; a few aliases cover the spellings the imported seasons use.

export interface NhlTeam {
  name: string;
  c1: string; // main colour: the card's background
  c2: string; // accent colour: the card's trim
}

export const NHL_TEAMS: Record<string, NhlTeam> = {
  ANA: { name: "Anaheim Ducks", c1: "#B9975B", c2: "#F47A38" },
  BOS: { name: "Boston Bruins", c1: "#1A1A1A", c2: "#FFB81C" },
  BUF: { name: "Buffalo Sabres", c1: "#003087", c2: "#FFB81C" },
  CGY: { name: "Calgary Flames", c1: "#C8102E", c2: "#F1BE48" },
  CAR: { name: "Carolina Hurricanes", c1: "#CC0000", c2: "#A2AAAD" },
  CHI: { name: "Chicago Blackhawks", c1: "#CF0A2C", c2: "#1A1A1A" },
  COL: { name: "Colorado Avalanche", c1: "#6F263D", c2: "#236192" },
  CBJ: { name: "Columbus Blue Jackets", c1: "#002654", c2: "#CE1126" },
  DAL: { name: "Dallas Stars", c1: "#006847", c2: "#8F8F8C" },
  DET: { name: "Detroit Red Wings", c1: "#CE1126", c2: "#FFFFFF" },
  EDM: { name: "Edmonton Oilers", c1: "#041E42", c2: "#FF4C00" },
  FLA: { name: "Florida Panthers", c1: "#041E42", c2: "#C8102E" },
  LA: { name: "Los Angeles Kings", c1: "#111111", c2: "#A2AAAD" },
  MIN: { name: "Minnesota Wild", c1: "#154734", c2: "#A6192E" },
  MTL: { name: "Montreal Canadiens", c1: "#AF1E2D", c2: "#192168" },
  NSH: { name: "Nashville Predators", c1: "#041E42", c2: "#FFB81C" },
  NJ: { name: "New Jersey Devils", c1: "#CE1126", c2: "#111111" },
  NYI: { name: "New York Islanders", c1: "#00539B", c2: "#F47D30" },
  NYR: { name: "New York Rangers", c1: "#0038A8", c2: "#CE1126" },
  OTT: { name: "Ottawa Senators", c1: "#C52032", c2: "#C2912C" },
  PHI: { name: "Philadelphia Flyers", c1: "#F74902", c2: "#111111" },
  PIT: { name: "Pittsburgh Penguins", c1: "#111111", c2: "#FCB514" },
  SJ: { name: "San Jose Sharks", c1: "#006D75", c2: "#111111" },
  SEA: { name: "Seattle Kraken", c1: "#001628", c2: "#99D9D9" },
  STL: { name: "St. Louis Blues", c1: "#002F87", c2: "#FCB514" },
  TB: { name: "Tampa Bay Lightning", c1: "#002868", c2: "#FFFFFF" },
  TOR: { name: "Toronto Maple Leafs", c1: "#00205B", c2: "#FFFFFF" },
  UTA: { name: "Utah Mammoth", c1: "#71AFE5", c2: "#090909" },
  VAN: { name: "Vancouver Canucks", c1: "#00205B", c2: "#00843D" },
  VGK: { name: "Vegas Golden Knights", c1: "#B4975A", c2: "#333F42" },
  WSH: { name: "Washington Capitals", c1: "#041E42", c2: "#C8102E" },
  WPG: { name: "Winnipeg Jets", c1: "#041E42", c2: "#7B303E" },
};

const ALIAS: Record<string, string> = { TBL: "TB", SJS: "SJ", LAK: "LA", NJD: "NJ", UTAH: "UTA", VGS: "VGK", WAS: "WSH", MON: "MTL", CLS: "CBJ", PHX: "UTA", ARI: "UTA" };

export function nhlTeam(abbrev: string | undefined | null): (NhlTeam & { abbrev: string }) | null {
  if (!abbrev) return null;
  const a = abbrev.trim().toUpperCase();
  const key = NHL_TEAMS[a] ? a : ALIAS[a];
  return key && NHL_TEAMS[key] ? { ...NHL_TEAMS[key], abbrev: key } : null;
}

// A darker shade of a hex colour, for the card's gradients.
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
