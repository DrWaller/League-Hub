"use client";

import { useState } from "react";

// A player's ESPN headshot in a circle, falling back to initials when ESPN has no photo.
export default function PlayerPhoto({ playerId, name, size = 48 }: { playerId: number; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  // First try a small resized copy from ESPN's image combiner (the originals are 350x254, far bigger than the
  // 30-90px circles shown here). If that URL doesn't work, fall back to the full image, then to initials.
  const [useFull, setUseFull] = useState(false);
  const fullUrl = `https://a.espncdn.com/i/headshots/nhl/players/full/${playerId}.png`;
  const h = Math.round(size * 2); // 2x for sharp phone screens
  const w = Math.round(h * (350 / 254));
  const src = useFull || h >= 254 ? fullUrl : `https://a.espncdn.com/combiner/i?img=/i/headshots/nhl/players/full/${playerId}.png&w=${w}&h=${h}`;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const style = { width: size, height: size };
  if (failed) {
    return (
      <span className="rounded-full bg-rink text-ice flex items-center justify-center font-display shrink-0 ring-2 ring-gold/70" style={{ ...style, fontSize: size * 0.36 }}>
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => (src === fullUrl ? setFailed(true) : setUseFull(true))}
      className="rounded-full object-cover object-top bg-ice-panel shrink-0 ring-2 ring-gold/70"
      style={style}
    />
  );
}
