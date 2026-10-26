import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import {
  bildVerkleinerung,
  bildausfaelleVermerken,
} from "../../services/app/src/import/bildverkleinerung";
import { validateDescribeImageDataUrl } from "../../services/reasoner/src/image-validation";
import { baueFrischeBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";
afterEach(schliesseBuehnen);
const bild = async () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 9, g: 20, b: 60 } } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Make: "SyntheticCam" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "52/1 31/1 0/1" },
    })
    .toBuffer();
const url = (b: Buffer, mime = "jpeg") => `data:image/${mime};base64,${b.toString("base64")}`;
const ausHtml = (html: string) => {
  const m = /src="data:image\/[^;]+;base64,([^"]+)"/.exec(html);
  if (!m?.[1]) throw new Error("Gespeichertes Bild fehlt");
  return Buffer.from(m[1], "base64");
};
describe("W4.6 sichere gespeicherte Bilder", () => {
  it("auch ein kleines Bild wird ohne EXIF/GPS und mit erhaltener Orientierung abgeleitet", async () => {
    const b = await bild();
    expect(b.length).toBeLessThan(64 * 1024);
    const v = bildVerkleinerung();
    const src = await v.mapImage(url(b));
    const out = Buffer.from(src.split(",")[1] ?? "", "base64");
    expect(out.equals(b)).toBe(false);
    const meta = await sharp(out).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.width).toBe(48);
    expect(meta.height).toBe(64);
    expect(v.bericht.ausfaelle).toEqual([]);
  });
  it("Maße werden vor jedem Pixellauf geprüft; defekte/gefährliche Quellen bleiben weder im Import noch im Describe-Eingang", async () => {
    const header = Buffer.alloc(33);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header);
    header.write("IHDR", 12);
    header.writeUInt32BE(30000, 16);
    header.writeUInt32BE(30000, 20);
    const src = url(header, "png");
    expect(validateDescribeImageDataUrl(src)).toEqual({ ok: false, code: "dimensions" });
    const v = bildVerkleinerung();
    expect(await v.mapImage(src)).not.toBe(src);
    const html = bildausfaelleVermerken(
      `<p>Quelle bleibt</p><figure><img src="${src}"><figcaption>Herkunft</figcaption></figure>`,
      v.bericht.ausfaelle,
    );
    expect(html).not.toContain(src);
    expect(html).toContain("sicher entfernt");
    expect(html).toContain("Herkunft");
  });
  it.each(["einfach", "leerzeichen", "ohneAnfuehrung"] as const)(
    "normale HTML-Attributvariante %s umgeht weder Metadatenbereinigung noch Quellenanker",
    async (art) => {
      const w = await baueFrischeBuehne();
      const src = url(await bild());
      const attr =
        art === "einfach"
          ? `src='${src}'`
          : art === "leerzeichen"
            ? `SRC = "${src}"`
            : `src=${src}`;
      const bodyHtml = `<figure data-image-id="kw-img-w46"><img data-image-id="kw-img-w46" ${attr}><figcaption data-image-id="kw-img-w46">Quellenanker bleibt</figcaption></figure>`;
      const res = await w.app.inject({
        method: "POST",
        url: "/api/drafts",
        headers: { authorization: `Bearer ${w.sitzung.experte}` },
        payload: { title: "HTML-Variante", bodyHtml },
      });
      expect(res.statusCode, res.body).toBe(201);
      const saved = res.json().payload.bodyHtml;
      expect(saved).toContain("Quellenanker bleibt");
      expect(saved).toContain('data-image-id="kw-img-w46"');
      const meta = await sharp(ausHtml(saved)).metadata();
      expect(meta.exif).toBeUndefined();
      expect([meta.width, meta.height]).toEqual([48, 64]);
    },
  );
  it("POST und PUT echter Drafts entfernen EXIF und weisen eine gefährliche Änderung ohne Bestandsverlust ab", async () => {
    const w = await baueFrischeBuehne();
    const headers = { authorization: `Bearer ${w.sitzung.experte}` };
    const src = url(await bild());
    const bodyHtml = `<figure><img src="${src}"><figcaption>Quelle Wartung</figcaption></figure>`;
    const post = await w.app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: { title: "Bildprobe", statement: "Bildbeobachtung", bodyHtml },
    });
    expect(post.statusCode, post.body).toBe(201);
    expect((await sharp(ausHtml(post.json().payload.bodyHtml)).metadata()).exif).toBeUndefined();
    expect(post.json().payload.bodyHtml).toContain("Quelle Wartung");
    const put = await w.app.inject({
      method: "PUT",
      url: `/api/drafts/${post.json().id}`,
      headers,
      payload: { bodyHtml, expectedUpdatedAt: post.json().updatedAt },
    });
    expect(put.statusCode, put.body).toBe(200);
    expect((await sharp(ausHtml(put.json().payload.bodyHtml)).metadata()).exif).toBeUndefined();
    const header = Buffer.alloc(33);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header);
    header.write("IHDR", 12);
    header.writeUInt32BE(30000, 16);
    header.writeUInt32BE(30000, 20);
    const attack = await w.app.inject({
      method: "PUT",
      url: `/api/drafts/${post.json().id}`,
      headers,
      payload: {
        bodyHtml: `<img src="${url(header, "png")}">`,
        expectedUpdatedAt: put.json().updatedAt,
      },
    });
    expect(attack.statusCode, attack.body).toBe(400);
    expect((await w.services.capture.getDraft(post.json().id))?.payload.bodyHtml).toBe(
      put.json().payload.bodyHtml,
    );
  });
});
