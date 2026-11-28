import type { Page } from "@playwright/test";
import sharp from "sharp";

/** Die eingebetteten Ein-Pixel-Proben bleiben auch bei einer verlustfreien WebP-Umwandlung erkennbar. */
export async function bildpixel(quelle: string | null): Promise<string> {
  const daten = /^data:image\/(?:png|gif|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(quelle ?? "");
  if (!daten) throw new Error("Eine eingebettete Rastergrafik wurde erwartet.");
  const rgba = await sharp(Buffer.from(daten[1], "base64"), { limitInputPixels: 1 })
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer();
  return rgba.toString("hex");
}

export async function galeriebilder(page: Page) {
  const bilder = await page
    .locator('button[title] img[src^="data:image"]')
    .evaluateAll((elemente) =>
      elemente.map((bild) => ({
        quelle: bild.getAttribute("src"),
        caption: bild.getAttribute("alt"),
      })),
    );
  return Promise.all(
    bilder.map(async ({ quelle, caption }) => ({ pixel: await bildpixel(quelle), caption })),
  );
}
