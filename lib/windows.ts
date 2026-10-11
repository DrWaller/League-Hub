// Server-side only. The days a tool looks at: the next 3 days, a fantasy matchup, or its early (M-W) or late (Th-Su) half.
import { getScoringPeriodsForWeek } from "@/lib/espn";

export type PickupWindow = "3d" | "current" | "next" | "early" | "late" | "next-early" | "next-late";
export const PICKUP_WINDOWS: PickupWindow[] = ["3d", "current", "next", "early", "late", "next-early", "next-late"];
const EARLY_DAYS = ["Mon", "Tue", "Wed"]; // early week = M-W, late week = Th-Su

// days: the upcoming days (offset from today + a label starting with the weekday, e.g. "Mon, Oct 12").
export async function resolveWindow(
  windowKey: PickupWindow,
  days: { offset: number; label: string }[],
  current: number,
  currentWeek: number
): Promise<{ offs: number[]; label: string }> {
  let offs: number[] = [0, 1, 2];
  let label = "the next 3 days";
  if (windowKey === "3d") return { offs, label };
  const part = windowKey.endsWith("early") ? "early" : windowKey.endsWith("late") ? "late" : null;
  const dayName = (o: number) => (days.find((d) => d.offset === o)?.label ?? "").slice(0, 3);
  const inPart = (o: number) => (part === null ? true : part === "early" ? EARLY_DAYS.includes(dayName(o)) : !EARLY_DAYS.includes(dayName(o)));
  const partName = part === "early" ? "early week (M-W)" : part === "late" ? "late week (Th-Su)" : null;
  const load = async (wk: number) => {
    const periods = await getScoringPeriodsForWeek(wk).then((r) => r.periods).catch(() => [] as number[]);
    return periods.map((sp) => sp - current).filter((o) => o >= 0 && o < 21 && inPart(o));
  };
  let wk = windowKey.startsWith("next") ? currentWeek + 1 : currentWeek;
  let got = await load(wk);
  let rolled = false;
  if (got.length === 0 && wk === currentWeek) {
    // That part of this matchup is already played, so look at the same part of next matchup.
    wk = currentWeek + 1;
    got = await load(wk);
    rolled = true;
  }
  if (got.length > 0) {
    offs = got;
    label = partName
      ? `${partName} of matchup ${wk}${rolled ? " (this week's is over)" : ""}`
      : wk !== currentWeek
        ? `matchup ${wk}`
        : `the rest of matchup ${wk}`;
  }
  return { offs, label };
}
