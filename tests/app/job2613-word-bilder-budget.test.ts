// ================================================================================================
// JOB 2613 · D1 — DAS BUDGET NIMMT BILDER, NICHT DAS GANZE DOKUMENT.
// ================================================================================================
//
// PEDIS BEFUND (Station 1 des Pfads): „Die Word-Erfassung verliert alle Bilder — nur Fussnoten
// kommen an."
//
// DIE MESSUNG (JOB 2613 D1, Sonde V1/V2, Protokoll in der Arbeitsspur):
//
//   Ein Dokument mit VIER Bildern zu je 1 MB Base64. Word liefert alle vier aus — die
//   Bild-Bilanz sagt `undeliveredImages: 0`, es fehlt also NICHTS an der Office-Schnittstelle.
//   Der finale Payload liegt bei rund 4 MB und damit ueber `WORD_ADDIN_BODY_BUDGET_BYTES`
//   (3,5 MB). Bis hierher fiel deshalb der GANZE HTML-Rumpf weg und der Entwurf bekam den
//   reinen Text: null Bilder, keine Formatierung, keine Tabellen. Nur die Fussnoten (Text)
//   kamen an — genau Pedis Bild.
//
//   DIE KANTE liegt bei rund DREI Fotos: 1, 2 und 3 Bilder zu je 1 MB gehen durch, das vierte
//   loescht alle vier. Zehn Bilder zu je 300 kB gehen ebenfalls durch. Es ist also keine
//   Bildzahl-Grenze, sondern eine Byte-Grenze — und sie schlaegt alles auf einmal aus.
//
// DIE REGEL, die dieser Test durchsetzt: Ist ein Dokument zu gross, wird das TEUERSTE Bild
// weggelassen und erneut gemessen — so lange, bis der Rest passt. Der Mensch behaelt
// Formatierung, Fussnoten und so viele Bilder wie moeglich. Der Klartext-Rueckfall bleibt fuer
// den Fall, dass es AUCH OHNE JEDES BILD nicht reicht.
//
// WAS NICHT GEGENSTAND IST: Bilder zu holen, die Word gar nicht herausgibt (`undeliveredImages`)
// — dafuer gibt es den Weg aus mega74 (`holeWordBilder`/`fillWordImages`), und der bleibt
// unveraendert. Hier geht es allein um Bilder, die Word GELIEFERT hat und die auf dem letzten
// Meter verloren gingen.
import { describe, expect, it } from "vitest";
import {
  WORD_ADDIN_BODY_BUDGET_BYTES,
  countUndeliveredWordImages,
  prepareWordDraftRequest,
  trimWordImagesToBudget,
  wordHtmlUtf8Bytes,
} from "../../apps/web/src/lib/wordAddin";

/** PNG-Magic-Bytes, damit die Bilder als echte Rasterbilder durchgehen. */
const PNG = "iVBORw0KGgo";

function bild(bytes: number): string {
  return PNG + "A".repeat(Math.max(0, bytes - PNG.length));
}

/** Ein Word-Dokument mit Text, N eingebetteten Bildern und einer Fussnote. */
function dokument(groessen: readonly number[]): string {
  let html = "<html><body><p>Ein Absatz mit Text.</p>";
  for (const g of groessen) {
    html += `<p><img src="data:image/png;base64,${bild(g)}"></p>`;
  }
  html += "<p>Eine Fussnote.</p></body></html>";
  return html;
}

function bilderIm(payload: string): number {
  return (payload.match(/<img\\b/gi) ?? payload.match(/<img\b/gi) ?? []).length;
}

const TEXT = "Ein Absatz mit Text. Eine Fussnote.";

describe("JOB 2613 D1 · das Budget nimmt Bilder, nicht das ganze Dokument", () => {
  it("B0 · KALIBRIERUNG: der gemessene Fall sprengt das Budget wirklich, und Word liefert alle Bilder", () => {
    // Ohne diese Kalibrierung koennte B1 gruen sein, weil der Fall das Budget gar nicht erreicht —
    // dann pruefte er nichts.
    const html = dokument([1_000_000, 1_000_000, 1_000_000, 1_000_000]);
    const inner = html.replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, "");
    expect(wordHtmlUtf8Bytes(inner), "der Fall liegt gar nicht ueber dem Budget").toBeGreaterThan(
      WORD_ADDIN_BODY_BUDGET_BYTES,
    );
    // Und es fehlt nichts an der Office-Schnittstelle: alle vier sind als data:-URL da.
    expect(countUndeliveredWordImages(inner), "Word hat Bilder NICHT geliefert").toBe(0);
  });

  it("B1 · VIER BILDER, EINES ZU VIEL: der Entwurf behaelt Bilder statt keines", () => {
    const prepared = prepareWordDraftRequest(
      dokument([1_000_000, 1_000_000, 1_000_000, 1_000_000]),
      TEXT,
    );

    // DER KERN: der HTML-Rumpf ueberlebt.
    expect(prepared.usedHtml, "der ganze Rumpf faellt weiterhin weg").toBe(true);
    expect(prepared.plainTextFallback).toBe(false);
    // Der finale Payload liegt IM Budget — deshalb ist `overBudget` hier falsch.
    expect(wordHtmlUtf8Bytes(prepared.payload)).toBeLessThanOrEqual(WORD_ADDIN_BODY_BUDGET_BYTES);
    expect(prepared.overBudget).toBe(false);
    // Es wurde etwas weggelassen, und die Zahl ist echt gezaehlt.
    expect(prepared.droppedImages).toBeGreaterThan(0);
    // UND es sind wirklich noch Bilder drin — das ist Pedis Abnahme.
    expect(bilderIm(prepared.payload), "es kommt kein einziges Bild an").toBeGreaterThan(0);
    // Genau die weggelassenen fehlen, nicht mehr.
    expect(bilderIm(prepared.payload)).toBe(4 - prepared.droppedImages);
  });

  it("B2 · DAS GROESSTE ZUERST: ein dickes Bild kostet nicht die drei duennen", () => {
    // 3 MB + dreimal 300 kB = 3,9 MB, also ueber dem Budget. Faellt das grosse, bleiben 0,9 MB —
    // die drei kleinen passen bequem hinein.
    //
    // DIE ZAHLEN SIND KORRIGIERT, und der Grund gehoert hierher: Der erste Anlauf nahm 2 MB statt
    // 3 MB. Das ergibt 2,9 MB und liegt UNTER dem Budget — es war gar nichts wegzulassen, und der
    // Fall war rot, ohne dass am Produkt etwas fehlte. Aufgefallen ist es nur, weil die Zusicherung
    // die Anzahl nennt statt bloss „irgendetwas wurde weggelassen".
    const gross = 3_000_000;
    const klein = 300_000;
    const prepared = prepareWordDraftRequest(dokument([gross, klein, klein, klein]), TEXT);

    expect(prepared.usedHtml).toBe(true);
    expect(prepared.droppedImages, "es wurde mehr oder weniger als das grosse Bild geopfert").toBe(
      1,
    );
    expect(bilderIm(prepared.payload)).toBe(3);
    // Und das dicke ist wirklich weg, die duennen sind wirklich da.
    expect(prepared.payload).not.toContain(bild(gross));
    expect(prepared.payload).toContain(bild(klein));
  });

  it("B3 · UNVERAENDERT: passt alles, wird nichts weggelassen", () => {
    const prepared = prepareWordDraftRequest(dokument([300_000, 300_000]), TEXT);
    expect(prepared.usedHtml).toBe(true);
    expect(prepared.droppedImages).toBe(0);
    expect(prepared.overBudget).toBe(false);
    expect(bilderIm(prepared.payload)).toBe(2);
  });

  it("B4 · DIE GRENZE BLEIBT: ohne Bilder zu gross ⇒ weiterhin der Klartext-Rueckfall", () => {
    // Ein einziger riesiger Absatz — hier ist nichts wegzulassen, und die bisherige ehrliche
    // Meldung muss stehen bleiben. Genau dieser Fall ist die Kalibrierung von mega45 Block F.
    const prepared = prepareWordDraftRequest(
      `<html><body><p>${"x".repeat(WORD_ADDIN_BODY_BUDGET_BYTES)}</p></body></html>`,
      "Sehr langer Absatz.",
    );
    expect(prepared.usedHtml).toBe(false);
    expect(prepared.overBudget).toBe(true);
    expect(prepared.droppedImages).toBe(0);
  });

  it("B5 · DER TRIMMER selbst: nur eingebettete Bilder, ganzes Tag, groesstes zuerst", () => {
    const html = `<p>Text</p><p><img src="data:image/png;base64,${bild(1000)}"></p><p><img src="data:image/png;base64,${bild(100)}"></p><p><img src="cid:nichtgeliefert"></p>`;

    // Passt sofort ⇒ nichts anfassen.
    const nichts = trimWordImagesToBudget(html, () => true);
    expect(nichts.dropped).toBe(0);
    expect(nichts.html).toBe(html);
    expect(nichts.passt).toBe(true);

    // Erst wenn nur noch ein eingebettetes Bild drin ist, passt es.
    const einmal = trimWordImagesToBudget(html, (k) => (k.match(/base64/g) ?? []).length <= 1);
    expect(einmal.dropped).toBe(1);
    expect(einmal.passt).toBe(true);
    // Das GROESSTE ist gefallen, das kleine steht noch.
    expect(einmal.html).not.toContain(bild(1000));
    expect(einmal.html).toContain(bild(100));
    // Das NICHT gelieferte Bild bleibt unangetastet — es kostet kein Byte und ist die Stelle,
    // an der der Mensch sieht, dass dort etwas fehlte.
    expect(einmal.html).toContain('src="cid:nichtgeliefert"');
    // Und es bleibt ein ganzes Tag weniger, kein leeres <img>.
    expect((einmal.html.match(/<img\b/gi) ?? []).length).toBe(2);

    // Auch ohne jedes Bild zu gross ⇒ ehrliches `passt: false`.
    const nie = trimWordImagesToBudget(html, () => false);
    expect(nie.passt).toBe(false);
    expect(nie.dropped).toBe(2);
  });

  it("B6 · das Inline-Spiegelbild kennt beides", () => {
    // taskpane.html haelt eine verhaltensgleiche ES5-Kopie. Der Aequivalenztest in
    // word-addin.test.ts vergleicht die Rueckgaben; hier wird festgehalten, dass die Kopie den
    // Trimmer und das Feld ueberhaupt kennt, damit die Ursache beim Bruch sofort lesbar ist.
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { resolve } = require("node:path") as typeof import("node:path");
    const html = readFileSync(
      resolve(process.cwd(), "apps/web/public/word-addin/taskpane.html"),
      "utf8",
    );
    expect(html).toMatch(/function trimWordImagesToBudget/);
    expect(html).toMatch(/droppedImages:/);
    expect(html).toMatch(/prepared\.droppedImages/);
    // Der neue Schluessel steht in DE, EN und NL — je genau einmal.
    expect((html.match(/sendImagesDropped:/g) ?? []).length).toBe(3);
  });
});
