// Fantasy points are always shown with two decimals (62.60, 1,851.00): player points move in 0.05 steps, so
// two decimals is exact. Use these instead of rounding by hand.
export const pts = (n: number) => n.toFixed(2);
export const ptsComma = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th ... 21st, 22nd, 101st.
export function ordinal(n: number): string {
  const v = Math.abs(Math.round(n));
  const teen = v % 100 >= 11 && v % 100 <= 13;
  const suffix = teen ? "th" : v % 10 === 1 ? "st" : v % 10 === 2 ? "nd" : v % 10 === 3 ? "rd" : "th";
  return `${Math.round(n)}${suffix}`;
}
