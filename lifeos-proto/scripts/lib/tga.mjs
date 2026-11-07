/** Minimal TGA decoder (types 2 = truecolor, 10 = RLE truecolor; 24/32 bpp). Returns RGBA, top-left origin. */
export function decodeTGA(buf) {
  const idLen = buf[0];
  const type = buf[2];
  const width = buf.readUInt16LE(12);
  const height = buf.readUInt16LE(14);
  const bpp = buf[16];
  const desc = buf[17];
  if ((type !== 2 && type !== 10) || (bpp !== 24 && bpp !== 32)) throw new Error(`unsupported TGA type=${type} bpp=${bpp}`);
  const px = bpp / 8;
  const n = width * height;
  const src = Buffer.alloc(n * px);
  let p = 18 + idLen + (buf[1] ? buf.readUInt16LE(5) * Math.ceil(buf[7] / 8) : 0);
  if (type === 2) buf.copy(src, 0, p, p + n * px);
  else {
    let o = 0;
    while (o < n * px) {
      const h = buf[p++];
      const count = (h & 0x7f) + 1;
      if (h & 0x80) {
        for (let i = 0; i < count; i++) buf.copy(src, o + i * px, p, p + px);
        p += px;
      } else {
        buf.copy(src, o, p, p + count * px);
        p += count * px;
      }
      o += count * px;
    }
  }
  const topOrigin = (desc & 0x20) !== 0;
  const out = Buffer.alloc(n * 4);
  for (let y = 0; y < height; y++) {
    const sy = topOrigin ? y : height - 1 - y;
    for (let x = 0; x < width; x++) {
      const s = (sy * width + x) * px;
      const d = (y * width + x) * 4;
      out[d] = src[s + 2];
      out[d + 1] = src[s + 1];
      out[d + 2] = src[s];
      out[d + 3] = px === 4 ? src[s + 3] : 255;
    }
  }
  return { width, height, data: out, hasAlpha: px === 4 };
}
