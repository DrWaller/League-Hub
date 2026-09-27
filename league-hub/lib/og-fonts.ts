// Server-side only. Loads real font files for image generation (next/og's
// ImageResponse / Satori) -- unlike a normal <link> tag, Satori needs the
// actual font bytes, not a stylesheet URL. Google serves TrueType files
// only to older browsers that predate woff2 support, so the fetch below
// spoofs an old Chrome user-agent to get a format Satori can parse.
//
// Only STATIC (non-variable) font families reliably offer a legacy
// TrueType build this way -- variable fonts (like "Source Sans 3") often
// don't, so "Source Sans Pro" (the classic static family) is used instead
// for body text, even though the site itself uses "Source Sans 3" via a
// normal browser <link> tag, which has no such limitation.
//
// Cached per warm serverless instance so repeated image requests don't
// re-fetch fonts every time.

const OLD_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36";

const cache = new Map<string, ArrayBuffer>();

async function fetchFont(family: string, weight: number): Promise<ArrayBuffer> {
  const key = `${family}-${weight}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
    { headers: { "User-Agent": OLD_UA } }
  ).then((res) => res.text());

  const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!match) throw new Error(`Could not find a TrueType URL for ${family} ${weight}`);

  const data = await fetch(match[1]).then((res) => res.arrayBuffer());
  cache.set(key, data);
  return data;
}

type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" };

// Loads each font independently -- one failing (Google changes something,
// a network hiccup) no longer discards the others. Whatever succeeds gets
// used; getFontFamilies below tells the caller exactly which family names
// are safe to reference in styles.
export async function loadGraphicFonts(): Promise<LoadedFont[]> {
  const specs: { name: string; weight: 400 | 600 | 700 }[] = [
    { name: "Oswald", weight: 700 },
    { name: "Source Sans Pro", weight: 400 },
    { name: "Source Sans Pro", weight: 600 },
  ];

  const results = await Promise.allSettled(specs.map((s) => fetchFont(s.name, s.weight)));

  const fonts: LoadedFont[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      fonts.push({ name: specs[i].name, data: r.value, weight: specs[i].weight, style: "normal" });
    } else {
      console.error(`loadGraphicFonts: failed to load ${specs[i].name} ${specs[i].weight}`, r.reason);
    }
  });

  return fonts;
}

// Satori (the renderer behind next/og) throws HARD if a style references a
// font-family that isn't in the loaded fonts array -- it does not silently
// fall back. So the JSX must only ask for a family that's confirmed loaded
// (return undefined otherwise, which omits the CSS property and lets
// Satori's own bundled default take over for that text).
export function getFontFamilies(fonts: LoadedFont[]) {
  const hasDisplay = fonts.some((f) => f.name === "Oswald");
  const hasBody = fonts.some((f) => f.name === "Source Sans Pro");
  return {
    display: hasDisplay ? "Oswald" : undefined,
    body: hasBody ? "Source Sans Pro" : undefined,
  };
}
