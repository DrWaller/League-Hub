// Browser-side helpers for the admin logo/banner forms.

export type AdminResult = { ok?: boolean; url?: string; error?: string };

// Reads a response from the admin API without ever throwing. Vercel answers
// oversized or timed-out requests with plain text/HTML instead of JSON, which
// used to make the save fail silently.
export async function readResult(res: Response): Promise<AdminResult> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as AdminResult;
    if (!res.ok && !data.error) data.error = `Server error (${res.status})`;
    return data;
  } catch {
    if (res.status === 413) return { error: "That image is too big for the server. Try a smaller one." };
    if (res.status === 504) return { error: "The server timed out. Try again." };
    return { error: `Server error (${res.status})` };
  }
}

const MAX_SIDE = 1024;
const SKIP_BELOW_BYTES = 1.5 * 1024 * 1024;

// Phone photos and big exports can pass Vercel's ~4.5 MB request limit. Logos
// never need to be that large, so shrink anything big to 1024px (as PNG, which
// keeps transparency). Small files are sent untouched.
export async function prepareImage(file: File, opts?: { maxSide?: number; skipBelowBytes?: number }): Promise<File> {
  const maxSide = opts?.maxSide ?? MAX_SIDE;
  if (file.size <= (opts?.skipBelowBytes ?? SKIP_BELOW_BYTES)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "logo";
    return new File([blob], `${base}.png`, { type: "image/png" });
  } catch {
    return file;
  }
}
