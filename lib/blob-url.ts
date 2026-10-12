// Helpers for images stored in Vercel Blob.

const BLOB_HOST = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;

export const isBlobUrl = (url: string): boolean => BLOB_HOST.test(url);

// Widths Next's image optimizer accepts (its defaults for `images.sizes` and `images.deviceSizes`).
const ALLOWED_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920];

// A small, cached copy of a stored image, served through Next's optimizer instead of the full
// original file. Used where an image is drawn without next/image (such as inside an SVG).
// Anything that isn't a Blob URL is returned unchanged.
export function smallImageUrl(url: string, width: number, quality = 80): string {
  if (!isBlobUrl(url)) return url;
  const w = ALLOWED_WIDTHS.find((n) => n >= width) ?? ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1];
  return `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=${quality}`;
}
