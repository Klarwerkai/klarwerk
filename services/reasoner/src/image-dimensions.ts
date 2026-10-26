export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_IMAGE_EDGE = 16_384;
export function imageDimensions(b: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime === "image/png" && b.length >= 24 && b.toString("ascii", 12, 16) === "IHDR")
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    if (mime === "image/gif" && b.length >= 10)
      return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
    if (mime === "image/webp") {
      const type = b.toString("ascii", 12, 16);
      if (type === "VP8X" && b.length >= 30)
        return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
      if (type === "VP8L" && b.length >= 25 && b[20] === 0x2f) {
        const n = b.readUInt32LE(21);
        return { width: (n & 0x3fff) + 1, height: ((n >>> 14) & 0x3fff) + 1 };
      }
      if (type === "VP8 " && b.length >= 30 && b[23] === 0x9d && b[24] === 1 && b[25] === 0x2a)
        return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    }
    if (mime === "image/jpeg") {
      let p = 2;
      while (p + 3 < b.length) {
        if (b[p++] !== 0xff) return null;
        while (b[p] === 0xff) p++;
        const marker = b[p++];
        if (marker === undefined || marker === 0xda || marker === 0xd9) return null;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        const size = b.readUInt16BE(p);
        if (size < 2 || p + size > b.length) return null;
        if (
          [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
            marker,
          )
        )
          return { width: b.readUInt16BE(p + 5), height: b.readUInt16BE(p + 3) };
        p += size;
      }
    }
  } catch {
    return null;
  }
  return null;
}
export function safeImageDimensions(b: Buffer, mime: string): boolean {
  const d = imageDimensions(b, mime);
  return (
    d !== null &&
    d.width > 0 &&
    d.height > 0 &&
    d.width <= MAX_IMAGE_EDGE &&
    d.height <= MAX_IMAGE_EDGE &&
    d.width * d.height <= MAX_IMAGE_PIXELS
  );
}
