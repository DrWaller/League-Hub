// Shapes and tiny helpers for the team banners (Regular Season Champions,
// League Champions and Runner-Up). No database or ESPN calls in here, so both server and
// client code can import it.

export type BannerKind = "regular" | "champion" | "runnerUp";

export interface TeamBanner {
  key: string;
  season: number;
  kind: BannerKind;
  teamName: string;
  managerId: number | null;
  managerName: string | null;
  teamKey: string; // the season's team name, normalised -- identifies "that team that year"
  hasSeasonLook: boolean; // true when this season's logo/colours were set specifically for it
  logoUrl: string | null;
  primary: string; // banner fabric colour
  trim: string; // outline / accent colour
  text: string | null; // lettering colour; null = pick white or near-black automatically
}

// A team's look for one specific season (a franchise can change its name,
// logo and colours from year to year). Any part left null falls back to the
// team's general look.
export interface TeamSeasonLook {
  season: number;
  teamKey: string;
  logoUrl: string | null;
  primary: string | null;
  trim: string | null;
  text: string | null;
}

export const teamKey = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();

export interface BannerColors {
  primary: string;
  trim: string;
  text?: string | null; // null / missing = automatic
}

// Used for any team the commissioner hasn't picked colours for yet.
export const DEFAULT_BANNER_COLORS: BannerColors = { primary: "#123A61", trim: "#D9A441" };

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

// White or near-black text, whichever reads better on the given banner colour.
export function readableOn(hex: string): "#FFFFFF" | "#111111" {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#111111" : "#FFFFFF";
}

// The lettering colour a banner actually uses: the one chosen, or white/near-black.
export function textOn(primary: string, chosen?: string | null): string {
  return chosen && isHexColor(chosen) ? chosen : readableOn(primary);
}

// What each banner is called in the admin lists and screen-reader text.
export const BANNER_LABELS: Record<BannerKind, string> = {
  regular: "Regular Season Champions",
  champion: "League Champions",
  runnerUp: "Runner-Up",
};
