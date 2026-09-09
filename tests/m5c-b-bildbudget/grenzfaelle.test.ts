// ================================================================================================
// JOB 3400 · M5c-b-R2 — DIE GEGENFÄLLE: PNG, JPEG, DEFEKT, JENSEITS DER GRENZE
// ================================================================================================
//
// DIE HALBHEIT, DIE HIER AUSGESCHLOSSEN WIRD (Auftrag §8.4): den schönen Weg bauen und die
// Grenzfälle vertagen — dann kippt ein einziges defektes Bild den ganzen Import. Jeder Fall hier
// prüft dieselben drei Zusagen: die Antwort ist ehrlich (kein 500, kein leerer Entwurf), der
// Entwurf entsteht, und die ÜBRIGEN Bilder des Dokuments sind unberührt.
//
// EIN TESTHAKEN DARF MODELLIEREN, NICHT ERZWINGEN: Die Fixtures stellen einen Fehlerfall BEREIT
// (ein defektes PNG, eine Pixelbombe, ein JPEG). Keiner von ihnen greift in das ein, was gemessen
// wird — gemessen wird immer der gespeicherte Entwurf hinter der echten Route.
import JSZip from "jszip";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  BILD_GLEICHZEITIG,
  BILD_MAX_EINGABE_BYTES,
  BILD_MAX_KANTE,
  bildVerkleinerung,
} from "../../services/app/src/import/bildverkleinerung";
import { type Absatz, baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";
import { defektesPng, grossesPng, kleinesDefektesPng, pixelbombePng } from "./bilder";
import { bildquellen, rumpf, uebernehmen, uebernehmenBytes } from "./uebernahme";

/** Das gute Bild, das in jedem Gegenfall unberührt ankommen muss. */
const GUTES_PNG = grossesPng(1600, 1200).toString("base64");

/**
 * Derselbe Content-Type-Umbau, den `tests/m5c-b-addin-bildunterschriften/route.test.ts` (W1/W2)
 * für EMF benutzt: Der gemeinsame Bauer schreibt jeden Bildteil als `.png` und deklariert ihn als
 * `image/png`. Um mammoth wirklich eine `data:image/jpeg`-Quelle entlocken zu lassen, muss der
 * OOXML-Content-Type umgestellt werden — der Dateiname ist dafür belanglos, der deklarierte Typ
 * ist es nicht.
 */
async function alsJpegDeklarieren(bytes: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(bytes);
  const typen = await zip.file("[Content_Types].xml")?.async("string");
  expect(typen, "Der Bauer schreibt keine Content-Types mehr").toContain('ContentType="image/png"');
  zip.file(
    "[Content_Types].xml",
    (typen ?? "").replace('ContentType="image/png"', 'ContentType="image/jpeg"'),
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}

describe("JOB 3400 · Gegenfälle des Add-in-Bildwegs", () => {
  it("D · PNG: die Ableitung ist kleiner, bleibt eine erlaubte Rasterquelle und behält ihren Platz", async () => {
    const g = await uebernehmen([
      { art: "text", text: "Vor dem Bild." },
      { art: "bild", png: GUTES_PNG, alt: "profil.png" },
      { art: "text", text: "Nach dem Bild." },
    ]);
    const quellen = bildquellen(g.bodyHtml);
    expect(quellen).toHaveLength(1);
    // Der Server-Sanitizer lässt als data:image nur png|jpeg|gif|webp durch
    // (services/structure/src/sanitize.ts). Käme hier ein anderer Typ an, wäre das Bild im
    // gespeicherten Entwurf ersatzlos verschwunden — die Zusicherung prüft genau diese Naht.
    expect(quellen[0], "Die Ableitung ist kein vom Sanitizer erlaubter Rastertyp").toMatch(
      /^data:image\/(png|jpe?g|gif|webp);base64,/i,
    );
    expect(Buffer.from(rumpf(quellen[0] ?? ""), "base64").byteLength).toBeLessThan(
      Buffer.from(GUTES_PNG, "base64").byteLength,
    );
    // Die Ableitung hält die Zielkante wirklich ein — gemessen am Bild, nicht an der Absicht.
    const kopf = await sharp(Buffer.from(rumpf(quellen[0] ?? ""), "base64")).metadata();
    expect(Math.max(kopf.width ?? 0, kopf.height ?? 0)).toBeLessThanOrEqual(BILD_MAX_KANTE);
    // Und der Fliesstext um das Bild herum steht unverändert.
    expect(g.bodyHtml).toContain("Vor dem Bild.");
    expect(g.bodyHtml).toContain("Nach dem Bild.");
    expect(g.bilanz).toEqual({ imagesTotal: 1, imagesEmbedded: 1, imagesDropped: 0 });
    expect(g.ableitung).toEqual({
      imagesShrunk: 1,
      imagesKeptOriginal: 0,
      imageSkipReasons: [],
    });
  });

  it("E · JPEG: eine echte JPEG-Quelle wird abgeleitet, nicht durchgereicht", async () => {
    const jpeg = await sharp(grossesPng(1600, 1200)).jpeg({ quality: 92 }).toBuffer();
    const { bytes } = await baueDocx([{ art: "bild", png: jpeg.toString("base64") }]);
    const g = await uebernehmenBytes(await alsJpegDeklarieren(bytes));
    const quellen = bildquellen(g.bodyHtml);
    expect(quellen, "Das JPEG kam nicht im Entwurf an").toHaveLength(1);
    const abgeleitet = Buffer.from(rumpf(quellen[0] ?? ""), "base64");
    expect(
      abgeleitet.byteLength,
      `Das JPEG wurde unverändert durchgereicht (${abgeleitet.byteLength} Bytes)`,
    ).toBeLessThan(jpeg.byteLength);
    expect(g.bilanz).toEqual({ imagesTotal: 1, imagesEmbedded: 1, imagesDropped: 0 });
    expect(g.ableitung.imagesShrunk).toBe(1);
    expect(g.ableitung.imageSkipReasons).toEqual([]);
  });

  it("F · ein DEFEKTES Bild kippt weder den Import noch das gute Bild daneben", async () => {
    const absaetze: Absatz[] = [
      { art: "bild", png: defektesPng().toString("base64"), alt: "kaputt.png" },
      { art: "bild", png: GUTES_PNG, alt: "heil.png" },
    ];
    const g = await uebernehmen(absaetze);
    const quellen = bildquellen(g.bodyHtml);
    // Kein stiller Verlust: das defekte Bild steht mit seiner ORIGINALQUELLE da — genau so, wie es
    // ohne diesen Durchgang im Entwurf gestanden hätte. Es wurde nicht weggeworfen.
    expect(quellen, "Ein Bild ist still verschwunden").toHaveLength(2);
    expect(quellen[0], "Das defekte Bild hat seine Originalquelle verloren").toBe(
      `data:image/png;base64,${defektesPng().toString("base64")}`,
    );
    // Und das gute Bild daneben ist trotzdem abgeleitet worden.
    const gut = Buffer.from(rumpf(quellen[1] ?? ""), "base64");
    expect(
      gut.byteLength,
      "Das gute Bild wurde wegen des defekten Nachbarn nicht verkleinert",
    ).toBeLessThan(Buffer.from(GUTES_PNG, "base64").byteLength);
    expect(g.sourceImageCount).toBe(2);
    expect(g.bilanz).toEqual({ imagesTotal: 2, imagesEmbedded: 2, imagesDropped: 0 });
    // SICHTBAR STATT NUR IM PROTOKOLL: die ANTWORT der Route nennt den Ausfall und seinen Grund.
    // Ohne diese drei Felder stünde „ein Bild ist defekt" nur in einer Logdatei, die kein Mensch
    // am Bildschirm sieht.
    expect(g.ableitung).toEqual({
      imagesShrunk: 1,
      imagesKeptOriginal: 1,
      imageSkipReasons: ["nicht-dekodierbar"],
    });
  });

  it("F2 · ein KLEINES defektes Bild wird als defekt erkannt, nicht als „schon klein genug“ durchgewinkt", async () => {
    // DER BEFUND VON BEN (Runde 2, Korrekturpflicht 1), und er war richtig: Runde 2 hat dieses Bild
    // nur am KOPF gemessen — 64×64 Pixel, 190 Bytes — und daraus geschlossen, es sei bereits eine
    // angemessene Ableitung. Der Kopf sagt aber nur, was das Bild zu sein BEHAUPTET. Der IDAT-Block
    // darunter ist kein zlib-Strom; kein Anzeigeprogramm bekommt daraus ein Bild. „Erhaltene
    // `src`-Bytes beweisen keine Darstellbarkeit" — deshalb wird auch das kleine Bild WIRKLICH
    // dekodiert, bevor seine Quelle als brauchbare Ableitung durchgeht.
    //
    // Die Antwort bleibt dieselbe wie beim grossen Defekt: nichts wird weggeworfen, die
    // Originalquelle bleibt stehen, und der Grund heisst beim Namen „nicht-dekodierbar".
    const klein = kleinesDefektesPng().toString("base64");
    const g = await uebernehmen([{ art: "bild", png: klein, alt: "klein-kaputt.png" }]);
    expect(bildquellen(g.bodyHtml)).toEqual([`data:image/png;base64,${klein}`]);
    expect(g.ableitung).toEqual({
      imagesShrunk: 0,
      imagesKeptOriginal: 1,
      imageSkipReasons: ["nicht-dekodierbar"],
    });
    expect(g.bilanz).toEqual({ imagesTotal: 1, imagesEmbedded: 1, imagesDropped: 0 });
  });

  it("F3 · ein kleines HEILES Bild geht weiterhin unverändert durch", async () => {
    // Die Gegenprobe zu F2: die neue Dekodierprobe darf nicht jedes kleine Bild verdächtigen. Ein
    // kleines, heiles PNG behält seine Quelle mit dem Grund „schon-klein-genug" — eine erneute
    // verlustbehaftete Kodierung kostete hier Qualität, ohne Bytes zu sparen.
    const heil = grossesPng(64, 64, 7).toString("base64");
    const g = await uebernehmen([{ art: "bild", png: heil, alt: "klein-heil.png" }]);
    expect(bildquellen(g.bodyHtml)).toEqual([`data:image/png;base64,${heil}`]);
    expect(g.ableitung).toEqual({
      imagesShrunk: 0,
      imagesKeptOriginal: 1,
      imageSkipReasons: ["schon-klein-genug"],
    });
  });

  it("G · eine PIXELBOMBE wird abgewiesen, ohne den Entwurf oder das gute Bild zu verlieren", async () => {
    // 30000×30000 sind 900 Megapixel — dekodiert 2,7 GB. Die DATEI ist wenige hundert Bytes gross
    // und käme an jeder Bytegrenze vorbei; nur `limitInputPixels` sieht sie.
    const bombe = pixelbombePng(30_000, 30_000).toString("base64");
    const g = await uebernehmen([
      { art: "bild", png: bombe, alt: "bombe.png" },
      { art: "bild", png: GUTES_PNG, alt: "heil.png" },
    ]);
    const quellen = bildquellen(g.bodyHtml);
    expect(quellen, "Der Entwurf hat ein Bild verloren").toHaveLength(2);
    expect(quellen[0], "Die Pixelbombe wurde nicht bei ihrer Originalquelle belassen").toBe(
      `data:image/png;base64,${bombe}`,
    );
    const gut = Buffer.from(rumpf(quellen[1] ?? ""), "base64");
    expect(gut.byteLength).toBeLessThan(Buffer.from(GUTES_PNG, "base64").byteLength);
    expect(g.bilanz).toEqual({ imagesTotal: 2, imagesEmbedded: 2, imagesDropped: 0 });
    expect(g.ableitung).toEqual({
      imagesShrunk: 1,
      imagesKeptOriginal: 1,
      imageSkipReasons: ["nicht-dekodierbar"],
    });
  });

  it("G2 · die Bytegrenze der Eingabe greift, bevor überhaupt dekodiert wird", async () => {
    // WARUM DIESER FALL AM MODUL UND NICHT AN DER ROUTE hängt: `DOCX_DRAFT_BODY_LIMIT` (30 MiB)
    // begrenzt schon die Anfrage. Ein Bild über `BILD_MAX_EINGABE_BYTES` (32 MiB) kann die Route
    // nur über eine STARK gepackte `.docx` erreichen (entpackt sind bis 200 MiB erlaubt) — der
    // gemeinsame Bauer packt aber mit STORE. Der Fall wird deshalb an derselben Funktion gemessen,
    // die auch die Route benutzt, nur ohne den HTTP-Umweg. Kein zweiter Bildweg: dieselbe Funktion.
    const zuGross = Buffer.alloc(BILD_MAX_EINGABE_BYTES + 1, 0x7f);
    const quelle = `data:image/png;base64,${zuGross.toString("base64")}`;
    const v = bildVerkleinerung();
    const raus = await v.mapImage(quelle);
    expect(raus, "Die zu grosse Eingabe wurde doch angefasst").toBe(quelle);
    expect(v.bericht.uebersprungen).toEqual(["eingabe-zu-gross"]);
    expect(v.bericht.verkleinert).toBe(0);
  });

  it("P · nie mehr Bilder gleichzeitig in sharp als zugesagt", async () => {
    // Der heutige Aufrufer (`mapInlineImages`) ruft NACHEINANDER auf; die Zusage darf davon nicht
    // abhängen. Hier werden sechs Bilder ABSICHTLICH gleichzeitig eingereicht — die gemessene
    // Spitze muss trotzdem unter der Grenze bleiben.
    const v = bildVerkleinerung();
    const quellen = [0, 1, 2, 3, 4, 5].map(
      (i) => `data:image/png;base64,${grossesPng(900, 700, 1000 + i).toString("base64")}`,
    );
    const raus = await Promise.all(quellen.map((q) => v.mapImage(q)));
    expect(v.bericht.gesehen).toBe(6);
    expect(v.bericht.verkleinert, "Nicht alle sechs Bilder wurden abgeleitet").toBe(6);
    expect(
      v.bericht.gleichzeitigMax,
      `Es waren ${v.bericht.gleichzeitigMax} Bilder gleichzeitig in sharp`,
    ).toBeLessThanOrEqual(BILD_GLEICHZEITIG);
    // Und die Warteschlange hat die Bilder nicht vertauscht: jede Ableitung gehört zu ihrer Quelle.
    expect(new Set(raus).size, "Zwei Ableitungen sind identisch — Zuordnung verloren").toBe(6);
  });
});
