import sharp from "sharp";
import { expect } from "vitest";

/** Kleine eingebettete Grafiken werden als verlustfreie WebP-Dateien gespeichert. */
export async function pruefeBildpixel(url: string, png: string): Promise<void> {
  const daten = /^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/.exec(url)?.[1];
  if (!daten) throw new Error("Die gespeicherte WebP-Bildquelle fehlt.");
  const ziel = sharp(Buffer.from(daten, "base64"));
  expect((await ziel.metadata()).format).toBe("webp");
  const [quelle, gespeichert] = await Promise.all([
    sharp(Buffer.from(png, "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ziel.ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  expect(gespeichert.info.width).toBe(quelle.info.width);
  expect(gespeichert.info.height).toBe(quelle.info.height);
  expect(gespeichert.data).toEqual(quelle.data);
}
