// Short weekday labels for a player's game nights (M, Tu, W, Th, F, Sa, Su).
const SHORT: Record<string, string> = { Mon: "M", Tue: "Tu", Wed: "W", Thu: "Th", Fri: "F", Sat: "Sa", Sun: "Su" };

// day labels look like "Mon, Oct 12"
export function dayShort(label: string): string {
  return SHORT[label.slice(0, 3)] ?? label.slice(0, 2);
}
