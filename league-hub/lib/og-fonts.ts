// Server-side only. Loads real font files for image generation (next/og's
// ImageResponse / Satori) -- unlike a normal <link> tag, Satori needs the
// actual font bytes, not a stylesheet URL. Google serves TrueType files
// only to older browsers that predate woff2 support, so the fetch below
// spoofs an old Chrome user-agent to get a format Satori can parse.
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

export async function loadGraphicFonts() {
  const [oswald700, sourceSans400, sourceSans600] = await Promise.all([
    fetchFont("Oswald", 700),
    fetchFont("Source Sans 3", 400),
    fetchFont("Source Sans 3", 600),
  ]);

  return [
    { name: "Oswald", data: oswald700, weight: 700 as const, style: "normal" as const },
    { name: "Source Sans 3", data: sourceSans400, weight: 400 as const, style: "normal" as const },
    { name: "Source Sans 3", data: sourceSans600, weight: 600 as const, style: "normal" as const },
  ];
}
