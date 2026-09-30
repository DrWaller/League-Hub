import { OG } from "./og-theme";
import { getTeamLogos } from "./content";

// Team logos on the generated graphics.
//
// next/og fetches an <img src> itself while rendering, and an image it can't
// decode (WebP, SVG, a dead link) can break the WHOLE graphic. So logos are
// downloaded here first, checked by their file signature, and handed to the
// renderer as embedded data. Anything that isn't a PNG/JPEG/GIF, or fails to
// download, is simply left out and that team shows its initials instead.
//
// Logos are keyed by team id and belong to the CURRENT season's teams, so past
// seasons get none (a past team id may have belonged to someone else).

const cache = new Map<string, string | null>();

function detectMime(b: Uint8Array): string | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  return null;
}

async function toDataUri(url: string): Promise<string | null> {
  if (cache.has(url)) return cache.get(url)!;
  let result: string | null = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const mime = detectMime(bytes);
      if (mime && bytes.length < 3_000_000) result = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
      else console.warn(`Team logo skipped (unsupported type or too large): ${url}`);
    }
  } catch (err) {
    console.warn("Team logo download failed:", url, err);
  }
  cache.set(url, result);
  return result;
}

// Returns { teamId: dataUri } for every team that has a usable logo.
export async function loadLogoData(skip = false): Promise<Record<number, string>> {
  if (skip) return {};
  const logos = await getTeamLogos();
  const out: Record<number, string> = {};
  await Promise.all(
    Object.entries(logos).map(async ([id, url]) => {
      const data = await toDataUri(url);
      if (data) out[Number(id)] = data;
    })
  );
  return out;
}

const initialsOf = (name: string) =>
  name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// Square logo, or an initials tile when the team has none.
export function TeamBadge({ name, logo, size, fontFamily }: { name: string; logo?: string; size: number; fontFamily?: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element -- next/og JSX, not a browser page
    return <img src={logo} width={size} height={size} style={{ width: size, height: size, borderRadius: 4, objectFit: "cover" }} />;
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 4,
        background: OG.rink,
        color: OG.ice,
        fontFamily,
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

// Small "logo + team name" line used under player names. Renders nothing
// extra when the team has no logo, so it looks exactly like before.
export function TeamLine({ name, logo, size, fontSize, align = "center" }: { name: string; logo?: string; size: number; fontSize: number; align?: "center" | "flex-start" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: align, gap: 6, fontSize, color: OG.muted }}>
      {logo ? <TeamBadge name={name} logo={logo} size={size} /> : null}
      <div style={{ display: "flex" }}>{name}</div>
    </div>
  );
}
