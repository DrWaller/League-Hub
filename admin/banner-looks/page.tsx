import { getTeamBanners } from "@/lib/banners";
import BannerLooksManager, { BannerLookItem } from "@/components/BannerLooksManager";

export const dynamic = "force-dynamic";

export default async function AdminBannerLooksPage() {
  const banners = await getTeamBanners().catch(() => []);

  // One row per team per season (a team that won both banners gets one row).
  const byKey = new Map<string, BannerLookItem>();
  for (const b of banners) {
    const id = `${b.season}|${b.teamKey}`;
    const existing = byKey.get(id);
    if (existing) {
      existing.kinds.push(b.kind);
    } else {
      byKey.set(id, {
        id,
        season: b.season,
        teamKey: b.teamKey,
        teamName: b.teamName,
        managerName: b.managerName,
        kinds: [b.kind],
        logoUrl: b.logoUrl,
        primary: b.primary,
        trim: b.trim,
        custom: b.hasSeasonLook,
      });
    }
  }
  const items = Array.from(byKey.values()).sort((a, b) => b.season - a.season);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Banner Looks</h1>
      <p className="text-muted mb-8 max-w-prose">
        A banner shows the team name from that season. If a team had a different logo or colours back then
        (a renamed team, say), set them here for that season. Anything you leave alone uses the team&apos;s
        general logo and colours from the Team Logos page.
      </p>
      <BannerLooksManager items={items} />
    </div>
  );
}
