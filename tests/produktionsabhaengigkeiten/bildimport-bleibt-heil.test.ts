// ================================================================================================
// JOB 4272 · 6a — DER BILDIMPORT LÄUFT, UND ZWAR DURCH DIE ECHTE BIBLIOTHEK.
// ================================================================================================
//
// DIE MELDUNG: `sharp` 0.34.5 trägt GHSA-f88m-g3jw-g9cj (geerbte libvips-CVEs, Bereich <0.35.0)
// und GHSA-rgj7-g3m4-5g8c (libheif, Bereich <0.35.4). Beide betreffen die Verarbeitung NICHT
// VERTRAUENSWÜRDIGER Bilddaten in nativen Decodern — und genau solche Daten reicht Klarwerk hinein:
// `POST /api/drafts/from-docx` → `mapImage` → `services/app/src/import/bildverkleinerung.ts:34`.
// `sharp` ist damit das einzige der sieben Pakete, dessen Advisorybedingung Klarwerk
// NACHWEISLICH erfüllt: der Bildinhalt stammt aus einer hochgeladenen Fremddatei.
//
// WOZU DIESER TEST DA IST: Er ist die FUNKTIONSERHALTUNG. Eine gehobene `sharp`-Version bringt
// andere native Binärdateien mit; ob der Import danach noch dasselbe tut, lässt sich nicht aus der
// Versionsnummer ablesen, sondern nur messen. Deshalb läuft hier ein ECHTES PNG durch eine ECHTE
// `.docx` durch das ECHTE `sharp` — kein Doppel. Ein Doppel würde die Bibliothek nicht messen und
// wäre bei genau dieser Frage wertlos.
//
// WIRD ER NACH EINER VERSIONSÄNDERUNG ROT, ist das der Fund, für den dieser Auftrag existiert:
// dann wird die Versionsänderung zurückgenommen und der Befund berichtet — NICHT der Test
// angepasst (Auftrag §6, Red-first-Vertrag).
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { extractDocxRich } from "../../apps/web/src/lib/docx";
import {
  BILD_MAX_KANTE,
  bildVerkleinerung,
  bildausfaelleVermerken,
} from "../../services/app/src/import/bildverkleinerung";
import { alsPuffer, baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";
import { grossesPng, kleinesDefektesPng } from "../m5c-b-bildbudget/bilder";
import { kantenBefund } from "./waechter";

/**
 * Die Zielkante als LITERAL und nicht als `BILD_MAX_KANTE`.
 *
 * Das ist Absicht und der Kern der Kalibrierung (Auftrag §7, „Bildgrenze aufheben → rot"): Stünde
 * hier die Konstante, dann verschöbe sich die Zusicherung MIT ihr — wer die Grenze aufhebt, machte
 * den Test nicht rot, sondern bedeutungslos. Der Literalwert misst die Wirkung; die Zeile darunter
 * hält fest, dass Literal und Konstante dieselbe Zahl sind.
 */
const ZIELKANTE = 1280;

/** Die `src`-Werte aller `<img>` in Dokumentreihenfolge. */
function bildquellen(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1] ?? "");
}

function rumpf(quelle: string): Buffer {
  return Buffer.from(/base64,([\s\S]*)$/.exec(quelle)?.[1] ?? "", "base64");
}

describe("JOB 4272 · 6a — der Bildimport bleibt heil", () => {
  it("die Zielkante des Produkts ist die Zahl, gegen die hier gemessen wird", () => {
    expect(BILD_MAX_KANTE).toBe(ZIELKANTE);
  });

  it("ein echtes Bild in einer echten .docx bekommt eine echte Ableitung", async () => {
    const quellBild = grossesPng(1600, 1200);
    const { bytes } = await baueDocx([
      { art: "text", text: "Vor dem Bild." },
      { art: "bild", png: quellBild.toString("base64"), alt: "messbild.png" },
      { art: "text", text: "Nach dem Bild." },
    ]);
    // Eine echte Kopie VOR dem Lauf — sie ist der Massstab für „das Original bleibt unverändert".
    const vorher = Buffer.from(bytes);

    const verkleinerung = bildVerkleinerung();
    const ergebnis = await extractDocxRich(alsPuffer(bytes), { mapImage: verkleinerung.mapImage });

    const quellen = bildquellen(ergebnis.html);
    expect(quellen, "Das Bild kam nicht im Rumpf an").toHaveLength(1);
    const abgeleitet = rumpf(quellen[0] ?? "");

    // (1) Es gibt wirklich eine Ableitung, und sie ist kleiner als die Quelle.
    expect(verkleinerung.bericht.verkleinert).toBe(1);
    expect(abgeleitet.byteLength).toBeLessThan(quellBild.byteLength);

    // (2) Die längste Kante hält die Zielkante ein — gemessen AM BILD, durch das echte sharp.
    const kopf = await sharp(abgeleitet).metadata();
    // Dieselbe Funktion fährt `kalibrierung.test.ts` gegen eine Ableitung MIT aufgehobener Grenze;
    // dort muss sie reden, hier muss sie schweigen.
    expect(
      kantenBefund(kopf.width ?? 0, kopf.height ?? 0, ZIELKANTE),
      "Die Zielkante des Bildimports greift nicht mehr",
    ).toBeNull();
    // Und sie ist wirklich dekodierbar: erhaltene Bytes beweisen keine Darstellbarkeit.
    expect((await sharp(abgeleitet).raw().toBuffer()).byteLength).toBeGreaterThan(0);

    // (3) Das Original ist Byte für Byte unangetastet.
    expect(vorher.equals(bytes), "Die hochgeladene .docx wurde verändert").toBe(true);

    // (4) Der Fliesstext um das Bild herum steht unverändert.
    expect(ergebnis.html).toContain("Vor dem Bild.");
    expect(ergebnis.html).toContain("Nach dem Bild.");
  });

  it("ein defektes Bild wird NICHT weggeworfen, sondern mit Grund vermerkt", async () => {
    const defekt = kleinesDefektesPng();
    const { bytes } = await baueDocx([
      { art: "bild", png: grossesPng(1600, 1200).toString("base64") },
      { art: "bild", png: defekt.toString("base64"), alt: "defekt.png" },
    ]);

    const verkleinerung = bildVerkleinerung();
    const ergebnis = await extractDocxRich(alsPuffer(bytes), { mapImage: verkleinerung.mapImage });

    const quellen = bildquellen(ergebnis.html);
    expect(quellen, "Ein Bild ist aus dem Rumpf verschwunden").toHaveLength(2);

    // Das gute Bild ist abgeleitet …
    expect(quellen[0]).toMatch(/^data:image\/webp;base64,/);
    // … und das defekte steht UNVERÄNDERT in seiner Originalquelle da, statt zu fehlen.
    expect(
      rumpf(quellen[1] ?? "").equals(defekt),
      "Das defekte Bild wurde nicht im Original belassen",
    ).toBe(true);

    // Der Grund ist benannt und hängt an der richtigen Bildnummer.
    expect(verkleinerung.bericht.ausfaelle).toEqual([
      { bildNummer: 2, grund: "nicht-dekodierbar" },
    ]);

    // Und er steht AM BETROFFENEN BILD, nicht nur in einer Summe.
    const vermerkt = bildausfaelleVermerken(ergebnis.html, verkleinerung.bericht.ausfaelle);
    expect(vermerkt).toContain('<div class="panel panel-warning">');
    expect(vermerkt).toContain("konnte beim Import nicht gelesen werden");
    // Ohne Ausfall bleibt der Rumpf zeichengleich — ein heiler Import trägt keinen Hinweis.
    expect(bildausfaelleVermerken(ergebnis.html, [])).toBe(ergebnis.html);
  });
});
