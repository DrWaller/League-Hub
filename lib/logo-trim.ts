import { inflateSync } from "zlib";

// Finds the visible part of a PNG logo (everything that isn't transparent), so a logo saved on a big
// transparent canvas can be shown at the size it really is instead of shrinking to fit the padding.
// Only plain 8-bit PNGs with transparency are read; anything else returns null and is shown as-is.

export interface LogoBox {
  w: number; // whole image
  h: number;
  x: number; // visible area inside it
  y: number;
  bw: number;
  bh: number;
}

export function logoVisibleBox(src: string): LogoBox | null {
  try {
    const m = /^data:image\/png;base64,(.+)$/.exec(src);
    if (!m) return null;
    const buf = Buffer.from(m[1], "base64");
    if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return null;

    let pos = 8;
    let w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
    let trns: Buffer | null = null;
    const idat: Buffer[] = [];
    while (pos + 12 <= buf.length) {
      const len = buf.readUInt32BE(pos);
      const type = buf.toString("ascii", pos + 4, pos + 8);
      const data = buf.subarray(pos + 8, pos + 8 + len);
      if (type === "IHDR") {
        w = data.readUInt32BE(0);
        h = data.readUInt32BE(4);
        bitDepth = data[8];
        colorType = data[9];
        interlace = data[12];
      } else if (type === "tRNS") trns = data;
      else if (type === "IDAT") idat.push(data);
      else if (type === "IEND") break;
      pos += 12 + len;
    }
    if (!w || !h || bitDepth !== 8 || interlace !== 0) return null;
    const channels = colorType === 6 ? 4 : colorType === 4 ? 2 : colorType === 3 ? 1 : 0;
    if (!channels) return null; // no alpha channel to trim by
    if (colorType === 3 && !trns) return null;

    const raw = inflateSync(Buffer.concat(idat));
    const stride = w * channels;
    if (raw.length < h * (stride + 1)) return null;
    const px = Buffer.alloc(h * stride);
    for (let y = 0; y < h; y++) {
      const filter = raw[y * (stride + 1)];
      const rowIn = y * (stride + 1) + 1;
      const rowOut = y * stride;
      for (let i = 0; i < stride; i++) {
        const x = raw[rowIn + i];
        const a = i >= channels ? px[rowOut + i - channels] : 0;
        const b = y > 0 ? px[rowOut - stride + i] : 0;
        const c = i >= channels && y > 0 ? px[rowOut - stride + i - channels] : 0;
        let v: number;
        if (filter === 0) v = x;
        else if (filter === 1) v = x + a;
        else if (filter === 2) v = x + b;
        else if (filter === 3) v = x + ((a + b) >> 1);
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        } else return null;
        px[rowOut + i] = v & 255;
      }
    }

    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = y * stride + x * channels;
        const alpha = colorType === 6 ? px[o + 3] : colorType === 4 ? px[o + 1] : trns![px[o]] ?? 255;
        if (alpha > 12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { w, h, x: minX, y: minY, bw: maxX - minX + 1, bh: maxY - minY + 1 };
  } catch {
    return null;
  }
}
