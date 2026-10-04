"use client";

import { useState } from "react";

// A player's ESPN headshot in a circle, falling back to initials when ESPN has no photo.
export default function PlayerPhoto({ playerId, name, size = 48 }: { playerId: number; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
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
      src={`https://a.espncdn.com/i/headshots/nhl/players/full/${playerId}.png`}
      alt={name}
      onError={() => setFailed(true)}
      className="rounded-full object-cover object-top bg-ice-panel shrink-0 ring-2 ring-gold/70"
      style={style}
    />
  );
}
