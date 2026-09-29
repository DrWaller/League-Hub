// Server-side only. Loads font files for image generation (next/og's
// ImageResponse / Satori) from files bundled in this repo, rather than
// fetching them from Google at request time.
//
// These are STATIC instances, not the raw variable fonts Google now ships
// for both families. Two dead ends got ruled out first: fetching from
// Google at request time (both families are variable-only there, and the
// old-browser trick to get a legacy static file doesn't work reliably for
// variable fonts), and using the raw variable font files directly (the
// font-parsing code bundled with this Next.js version crashes trying to
// read a variable font's axis table). Each static file here was produced
// with `fonttools varLib.instancer` from the real Oswald/Source Sans 3
// variable fonts, at the exact weight needed, with the variable-axis data
// stripped out -- same visual design, a plain static TrueType file.

import { readFile } from "fs/promises";
import path from "path";

type LoadedFont = { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" };

let cached: LoadedFont[] | null = null;

export async function loadGraphicFonts(): Promise<LoadedFont[]> {
  if (cached) return cached;

  try {
    const dir = path.join(process.cwd(), "assets/fonts");
    const [oswaldBold, sourceSansRegular, sourceSansSemiBold] = await Promise.all([
      readFile(path.join(dir, "Oswald-Bold-Static.ttf")),
      readFile(path.join(dir, "SourceSans3-Regular-Static.ttf")),
      readFile(path.join(dir, "SourceSans3-SemiBold-Static.ttf")),
    ]);

    cached = [
      { name: "Oswald", data: oswaldBold, weight: 700, style: "normal" },
      { name: "Source Sans 3", data: sourceSansRegular, weight: 400, style: "normal" },
      { name: "Source Sans 3", data: sourceSansSemiBold, weight: 600, style: "normal" },
    ];
    return cached;
  } catch (err) {
    // Should only happen if the bundled files are missing from the
    // deployment -- a packaging problem, not a network one. Better a
    // plain-font image than a crash either way.
    console.error("loadGraphicFonts: failed to read bundled font files", err);
    return [];
  }
}

// Satori (the renderer behind next/og) throws HARD if a style references a
// font-family that isn't in the loaded fonts array -- it does not silently
// fall back. So the JSX must only ask for a family that's confirmed
// loaded (return undefined otherwise, which omits the CSS property).
export function getFontFamilies(fonts: LoadedFont[]) {
  const hasDisplay = fonts.some((f) => f.name === "Oswald");
  const hasBody = fonts.some((f) => f.name === "Source Sans 3");
  return {
    display: hasDisplay ? "Oswald" : undefined,
    body: hasBody ? "Source Sans 3" : undefined,
  };
}
