import { getLeagueMeta } from "@/lib/espn";
import { getMonthlyPeriods } from "@/lib/content";
import NewsletterEditor from "@/components/NewsletterEditor";

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  const [meta, periods] = await Promise.all([getLeagueMeta(), getMonthlyPeriods()]);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Newsletter</h1>
      <p className="text-muted mb-8">
        Write or AI-draft a recap. The rest of the newsletter page (scores, awards, trades) is
        compiled automatically — this is just the intro.
      </p>
      <NewsletterEditor defaultSeason={meta.season} defaultWeek={meta.currentWeek} periods={periods} />
    </div>
  );
}
