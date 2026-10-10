// Picks a team's banner colours from its logo: the main colour of the logo
// becomes the banner fabric, and the next most common clearly different colour
// becomes the trim. No server or browser APIs in here -- it works on raw pixel
// data (RGBA), so it can be tested and reused anywhere.

import { BannerColors, DEFAULT_BANNER_COLORS } from "./banner-types";

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

export function suggestColorsFromPixels(data: ArrayLike<number>): BannerColors {
  // Group similar colours into buckets (16 levels per channel), ignoring
  // see-through pixels, and remember each bucket's average colour.
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    cur.n += 1;
    cur.r += r;
    cur.g += g;
    cur.b += b;
    buckets.set(key, cur);
  }

  const colours = Array.from(buckets.values()).map((c) => {
    const rgb = [c.r / c.n, c.g / c.n, c.b / c.n];
    return { rgb, n: c.n, sat: saturation(rgb[0], rgb[1], rgb[2]), light: (rgb[0] + rgb[1] + rgb[2]) / 3 };
  });
  if (colours.length === 0) return DEFAULT_BANNER_COLORS;

  // Banner colour: the most common colour that isn't white, grey or black,
  // favouring vivid ones. A logo that is only black/white/grey falls back to
  // its most common non-white colour.
  const vivid = colours.filter((c) => c.sat > 0.35 && c.light > 40 && c.light < 235);
  const pool = vivid.length > 0 ? vivid : colours.filter((c) => c.light < 235);
  const primaryPool = pool.length > 0 ? pool : colours;
  const primary = primaryPool.reduce((best, c) => (c.n * (0.3 + c.sat) > best.n * (0.3 + best.sat) ? c : best));

  // Trim: the most common colour clearly different from the banner colour.
  const others = colours.filter((c) => dist(c.rgb, primary.rgb) > 110);
  const trim =
    others.length > 0
      ? others.reduce((best, c) => (c.n > best.n ? c : best))
      : { rgb: primary.light > 140 ? [26, 26, 26] : [255, 255, 255] };

  return { primary: toHex(primary.rgb[0], primary.rgb[1], primary.rgb[2]), trim: toHex(trim.rgb[0], trim.rgb[1], trim.rgb[2]) };
}

// Browser only: reads an image (a file the user picked, or a logo URL) and
// suggests colours. Resolves to null if the image can't be read.
export async function suggestColorsFromImage(source: File | string): Promise<BannerColors | null> {
  try {
    const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
    const bitmap = await createImageBitmap(blob);
    const size = 96;
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return suggestColorsFromPixels(ctx.getImageData(0, 0, w, h).data);
  } catch {
    return null;
  }
}
