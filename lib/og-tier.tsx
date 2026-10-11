// Tier pill for the graphics (next/og). Satori needs display:flex on any element with more than one child,
// so every element here is flex and holds a single text node.
import { TIER_STYLE, type Tier } from "@/lib/tier-style";
import { getTierIndex, type TierIndex } from "@/lib/tier-index";

export function TierPill({ tier, size = 20, align = "center", mt = 0 }: { tier?: Tier | null; size?: number; align?: "flex-start" | "center"; mt?: number }) {
  if (!tier) return null;
  const s = TIER_STYLE[tier];
  return (
    <div style={{ display: "flex", justifyContent: align, marginTop: mt }}>
      <div style={{ display: "flex", padding: `${Math.round(size * 0.12)}px ${Math.round(size * 0.55)}px`, borderRadius: 6, background: s.bg, color: s.fg, fontWeight: 700, fontSize: size, letterSpacing: 1.5, textTransform: "uppercase" }}>{tier}</div>
    </div>
  );
}

// Tiers are today's, so a past-season graphic leaves them off.
export async function graphicTiers(isPast: boolean): Promise<TierIndex> {
  return isPast ? {} : getTierIndex();
}
