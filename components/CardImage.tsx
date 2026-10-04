"use client";

import { useState } from "react";

// A player card image that simply disappears if it can't be made (ESPN down, public cards switched off).
export default function CardImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`bg-ice-panel ${className}`} style={{ aspectRatio: "1080 / 1350" }} />
  );
}
