import { OG } from "./og-theme";

// One shared avatar element for the graphics routes: a real player headshot
// when one's confirmed available, otherwise the initials circle they've
// always shown. Photos are anchored near the top so every head sits at the same height in the circle. `hasHeadshot` must be pre-checked by the caller (see
// lib/headshots.ts) -- next/og fetches an <img src> itself during rendering,
// and a broken/missing image there can break the whole graphic, so this
// component never gets to guess; it's told which one to use.
export function PlayerAvatar({
  name,
  src,
  hasHeadshot,
  size,
  fontFamily,
  fontSize,
  border,
}: {
  name: string;
  src: string;
  hasHeadshot: boolean;
  size: number;
  fontFamily?: string;
  fontSize: number;
  border?: string;
}) {
  const shared = { width: size, height: size, flexShrink: 0, borderRadius: size / 2, ...(border ? { border } : {}) };

  if (hasHeadshot) {
    // eslint-disable-next-line @next/next/no-img-element -- this is next/og's
    // ImageResponse JSX, not a browser page; a plain <img> is what Satori expects.
    return <img src={src} width={size} height={size} style={{ ...shared, objectFit: "cover", objectPosition: "50% 18%" }} />;
  }

  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      style={{
        ...shared,
        background: OG.rink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        fontSize,
        fontWeight: 700,
        color: OG.ice,
      }}
    >
      {initials}
    </div>
  );
}
