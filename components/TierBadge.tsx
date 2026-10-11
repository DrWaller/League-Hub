import { TIER_STYLE, type Tier } from "@/lib/tier-style";

// The league tier as a small coloured tag (Stream, Depth, Elite, Superstar, Franchise). Works in server and client components.
export default function TierBadge({ tier, title }: { tier?: Tier | null; title?: string }) {
  if (!tier) return null;
  const s = TIER_STYLE[tier];
  return (
    <span className="inline-block px-1 py-px text-[10px] leading-tight font-semibold align-middle" style={{ background: s.bg, color: s.fg }} title={title ?? `${tier} tier`}>
      {tier}
    </span>
  );
}
