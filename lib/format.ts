// Fantasy points are always shown with two decimals (62.60, 1,851.00): player points move in 0.05 steps, so
// two decimals is exact. Use these instead of rounding by hand.
export const pts = (n: number) => n.toFixed(2);
export const ptsComma = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
