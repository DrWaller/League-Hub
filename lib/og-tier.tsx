// Tier pill for the graphics (next/og). Satori needs display:flex on any element with more than one child,
// so every element here is flex and holds a single text node.
import { TIER_STYLE, type Tier } from "@/lib/tier-style";
import { getTierIndex, type TierIndex } from "@/lib/tier-index";

// Shown as a small colour dot plus the tier name in plain text (no filled badge), so it reads as part of the
// line it sits on. `onDark` flips the text for the navy graphics.
export function TierPill({ tier, size = 20, align = "center", mt = 0, onDark = false }: { tier?: Tier | null; size?: number; align?: "flex-start" | "center"; mt?: number; onDark?: boolean }) {
  if (!tier) return null;
  const s = TIER_STYLE[tier];
  const dot = Math.max(8, Math.round(size * 0.62));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: align, marginTop: mt }}>
      <div style={{ display: "flex", alignItems: "center", gap: Math.round(size * 0.4) }}>
        <div style={{ display: "flex", width: dot, height: dot, borderRadius: dot, background: s.bg, border: `${Math.max(1, Math.round(size * 0.07))}px solid ${onDark ? "rgba(255,255,255,0.55)" : "rgba(12,39,64,0.35)"}` }} />
        <div style={{ display: "flex", fontWeight: 700, fontSize: size, letterSpacing: Math.max(1, size * 0.1), textTransform: "uppercase", color: onDark ? "#C9D6E6" : "#4A5E75" }}>{tier}</div>
      </div>
    </div>
  );
}

// Tiers are today's, so a past-season graphic leaves them off.
export async function graphicTiers(isPast: boolean): Promise<TierIndex> {
  return isPast ? {} : getTierIndex();
}
