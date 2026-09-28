import { getLeagueMeta } from "@/lib/espn";
import MonthlyPeriodsManager from "@/components/MonthlyPeriodsManager";

export const dynamic = "force-dynamic";

export default async function AdminMonthlyPeriodsPage() {
  const meta = await getLeagueMeta();
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Monthly Periods</h1>
      <p className="text-muted mb-8">
        Define the week ranges Monthly Awards and the monthly newsletter will use.
      </p>
      <MonthlyPeriodsManager defaultSeason={meta.season} />
    </div>
  );
}
