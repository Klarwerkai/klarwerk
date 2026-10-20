// ================================================================================================
// OCR-E03 · BILDHAFTE TABELLEN ALS BEARBEITBARE TABELLEN (Auftrag produkt:20261012:klara-ocr-tabellen)
// ================================================================================================
//
// Kontrollierte Wortrahmen mit bekanntem Inhalt — so, wie die Engine (tesseract.js) sie liefert:
// Text, Sicherheit, Rahmen. Ersetzt ist allein die Engine; Raster, Automatik, Bearbeiten, HTML für
// den Editor (`normalizePastedHtml`, derselbe Sanitizer wie beim Einfügen) und Zwischenablage sind
// die echten Funktionen. Ob die echte Engine eine gezeichnete Tabelle liest, misst die Browserprobe
// `tests-smoke/klara-ocr-tabellen-browser.spec.ts`.
//
//   K1  bekannte Zahlen, leere Zellen, Überschrift → richtige Zeilen/Spalten, bearbeitbar
//   K2  Dezimalkomma, Vorzeichen, Einheiten, leere Zellen bleiben, wie sie sind — bis in die Kopie
//   K3  schwer lesbare Zelle → unsicher bzw. [unleserlich], kein erfundener Wert; mehrdeutige
//       Zuordnung gekennzeichnet; ohne verlässliches Raster keine Tabelle
//   K4  Kopie als HTML-Tabelle (Editor behält sie) und als tabulatorgetrennter Text
//   K6  Quellenzuordnung und Quellwechsel: Tabelle an Folie/Bild, Änderungen nur am selben Bild
//   K6  Nacharbeit 6 (Bens Befund): die gespeicherte OCR-E02-Berichtigung gilt in der Tabelle, und
//       Tabellenänderungen werden als eben diese Berichtigung gespeichert — gleiche Quelle und
//       Bildfassung, sonst keine Übertragung
import { describe, expect, it, vi } from "vitest";
import {
  type BildTabelle,
  type Bildbereich,
  TINTE_AB_ANTEIL,
  bildTabelleAusWoertern,
  createBildAnalyse,
  einzelbildEingang,
  leereZellBereiche,
  markiereUnerkannteInhalte,
  pptxBildEingang,
  tintenAnteil,
} from "../../apps/web/src/lib/bildAutomatik";
import {
  type BildKorrekturDaten,
  quellenMitKorrekturen,
} from "../../apps/web/src/lib/bildKorrektur";
import {
  aendereZelle,
  aktuelleZellen,
  berichtigungsText,
  kopiereTabelle,
  setzeZelleZurueck,
  standFuer,
  tabelleAlsHtml,
  tabelleAlsTsv,
  tabelleMitBerichtigung,
} from "../../apps/web/src/lib/bildTabelle";
import type { OcrResult, OcrWort } from "../../apps/web/src/lib/ocr";
import { normalizePastedHtml } from "../../apps/web/src/lib/richText";
import { bildMit, dataUrl, deck, lesePptx, markeAus } from "./deck";

function wort(text: string, x0: number, y0: number, sicherheit = 95): OcrWort {
  return { text, confidence: sicherheit, bbox: { x0, y0, x1: x0 + text.length * 18, y1: y0 + 30 } };
}

/**
 * Die kontrollierte Tabelle: Überschrift, bekannte Zahlen mit Dezimalkomma, Vorzeichen (auch das
 * typografische Minus U+2212) und Einheiten, leere Zellen in verschiedenen Spalten, eine Zeile mit
 * nur einem Wert in der Mitte. Darüber ein Titel, darunter Fließtext — beides gehört nicht dazu.
 */
function kontrollierteTabelle(sonder: Partial<Record<string, number>> = {}): OcrWort[] {
  const s = (text: string): number => sonder[text] ?? 95;
  return [
    wort("Wartungsliste", 20, -50),
    wort("Posten", 20, 10),
    wort("Menge", 300, 10),
    wort("Preis", 560, 10),
    wort("Abweichung", 820, 10),
    wort("Ventil", 20, 60),
    wort("4", 300, 60),
    wort("kg", 326, 60),
    wort("12,50", 560, 60),
    wort("€", 658, 60),
    wort("-3,5", 820, 60),
    wort("%", 904, 60),
    wort("Dichtung", 20, 110),
    wort("0,80", 560, 110),
    wort("€", 640, 110),
    wort("+1,2", 820, 110),
    wort("%", 904, 110),
    wort("Gehäuse", 20, 160),
    wort("Filter", 20, 210),
    wort("12,5", 300, 210, s("12,5")),
    wort("kg", 380, 210),
    wort("9,1", 560, 210, s("9,1")),
    wort("−0,4", 820, 210),
    wort("%", 904, 210),
    wort("Stand", 20, 300),
    wort("Oktober,", 120, 300),
    wort("alle", 276, 300),
    wort("Angaben", 360, 300),
    wort("ohne", 506, 300),
    wort("Gewähr.", 596, 300),
  ];
}

const ERWARTET = [
  ["Posten", "Menge", "Preis", "Abweichung"],
  ["Ventil", "4 kg", "12,50 €", "-3,5 %"],
  ["Dichtung", "", "0,80 €", "+1,2 %"],
  ["Gehäuse", "", "", ""],
  ["Filter", "12,5 kg", "9,1", "−0,4 %"],
];

const texte = (t: BildTabelle | null): string[][] =>
  (t?.zeilen ?? []).map((zeile) => zeile.map((z) => z.text));

// ================================================================================================
// K1 · Struktur und Weiterbearbeitung
// ================================================================================================
describe("K1 · kontrollierte Tabelle → richtige Zeilen und Spalten, bearbeitbar", () => {
  it("Überschrift, bekannte Zahlen und leere Zellen stehen an ihrer Stelle", () => {
    const tabelle = bildTabelleAusWoertern(kontrollierteTabelle());
    expect(tabelle).not.toBeNull();
    expect(tabelle?.spalten).toBe(4);
    expect(tabelle?.kopfzeilen).toBe(1);
    expect(texte(tabelle)).toEqual(ERWARTET);
    // Jede Zeile ist vollständig — auch die mit Lücken.
    for (const zeile of tabelle?.zeilen ?? []) {
      expect(zeile).toHaveLength(4);
    }
    // Leere Zellen sind als leer gekennzeichnet, nicht als unsicher, und tragen keinen Rahmen — nur
    // ihren Prüfbereich im Bild (Spalte × Zeile), an dem sie auf ungelesenen Inhalt geprüft werden.
    expect(tabelle?.zeilen[2]?.[1]).toEqual({
      text: "",
      zustand: "leer",
      mehrdeutig: false,
      bereich: { x0: 300, y0: 110, x1: 416, y1: 140 },
    });
    expect(tabelle?.zeilen[4]?.[1]?.zustand).toBe("sicher");
    // Titel darüber und Fließtext darunter gehören nicht zur Tabelle.
    expect(texte(tabelle).flat()).not.toContain("Wartungsliste");
    expect(texte(tabelle).flat().join(" ")).not.toContain("Gewähr");
  });

  it("jede Zelle mit Inhalt trägt ihren Rahmen im Bild (Fundstelle in der Ursprungstabelle)", () => {
    const tabelle = bildTabelleAusWoertern(kontrollierteTabelle());
    expect(tabelle?.zeilen[1]?.[2]?.rahmen).toEqual({ x0: 560, y0: 60, x1: 676, y1: 90 });
    expect(tabelle?.zeilen[4]?.[1]?.rahmen).toEqual({ x0: 300, y0: 210, x1: 416, y1: 240 });
  });

  it("ohne Ziffern darunter ist die erste Zeile keine Überschrift", () => {
    const tabelle = bildTabelleAusWoertern([
      wort("Montag", 20, 10),
      wort("Früh", 300, 10),
      wort("Dienstag", 20, 60),
      wort("Spät", 300, 60),
    ]);
    expect(tabelle?.kopfzeilen).toBe(0);
  });

  it("Zellen lassen sich ändern und einzeln zurücksetzen; der Befund bleibt unverändert", () => {
    const tabelle = bildTabelleAusWoertern(kontrollierteTabelle()) as BildTabelle;
    const vorher = structuredClone(tabelle);
    let stand = standFuer(null, "sha256:aaa");
    stand = aendereZelle(tabelle, stand, 2, 1, "6 kg");
    stand = aendereZelle(tabelle, stand, 4, 2, "9,10 €");
    const jetzt = aktuelleZellen(tabelle, stand);
    expect(jetzt[2]?.[1]).toMatchObject({ wert: "6 kg", erkannt: "", bearbeitet: true });
    expect(jetzt[4]?.[2]).toMatchObject({ wert: "9,10 €", erkannt: "9,1", bearbeitet: true });
    expect(jetzt[1]?.[1]).toMatchObject({ wert: "4 kg", bearbeitet: false });
    stand = setzeZelleZurueck(stand, 2, 1);
    expect(aktuelleZellen(tabelle, stand)[2]?.[1]).toMatchObject({ wert: "", bearbeitet: false });
    // Zurück auf den erkannten Wert getippt: keine Änderung mehr.
    stand = aendereZelle(tabelle, stand, 4, 2, "9,1");
    expect(stand.aenderungen).toEqual({});
    expect(tabelle).toEqual(vorher);
  });
});

// ================================================================================================
// K2 · Nichts wird still verfälscht
// ================================================================================================
describe("K2 · Dezimalkomma, Vorzeichen, Einheiten und leere Zellen bleiben, wie sie sind", () => {
  it("vom Raster über das Editor-HTML bis in den Tabulatortext", () => {
    const tabelle = bildTabelleAusWoertern(kontrollierteTabelle()) as BildTabelle;
    const werte = aktuelleZellen(tabelle, standFuer(null, null)).map((z) => z.map((x) => x.wert));
    expect(werte).toEqual(ERWARTET);

    const html = normalizePastedHtml(tabelleAlsHtml(werte, tabelle.kopfzeilen));
    for (const wert of ["12,50 €", "0,80 €", "-3,5 %", "+1,2 %", "−0,4 %", "4 kg", "12,5 kg"]) {
      expect(html).toContain(`<td>${wert}</td>`);
    }
    // Leere Zellen bleiben leere Zellen — keine Null, kein Strich, kein Nachbarwert.
    expect(html).toContain("<tr><td>Dichtung</td><td></td><td>0,80 €</td>");
    expect(html).toContain("<tr><td>Gehäuse</td><td></td><td></td><td></td></tr>");

    const tsv = tabelleAlsTsv(werte);
    expect(tsv.split("\n").map((zeile) => zeile.split("\t"))).toEqual(ERWARTET);
  });

  it("Sonderzeichen werden maskiert, nicht verändert; Tabulator in einer Zelle bleibt eine Zelle", () => {
    const werte = [
      ["Grenze", "Wert"],
      ["<0,5 mg/l", 'A & B "x"'],
      ["Tab\tim Wert", "1.234,56"],
    ];
    const html = normalizePastedHtml(tabelleAlsHtml(werte, 1));
    expect(html).toContain("<td>&lt;0,5 mg/l</td>");
    expect(html).toContain("<td>1.234,56</td>");
    const tsv = tabelleAlsTsv(werte);
    expect(tsv).toBe('Grenze\tWert\n<0,5 mg/l\t"A & B ""x"""\n"Tab\tim Wert"\t1.234,56');
  });
});

// ================================================================================================
// K3 · Unsicher markieren statt erfinden
// ================================================================================================
describe("K3 · schwer lesbare Zelle → gekennzeichnet, kein plausibler Wert", () => {
  it("sehr unsicher: [unleserlich] statt der Lesung — auch in HTML und Text", () => {
    const tabelle = bildTabelleAusWoertern(kontrollierteTabelle({ "9,1": 12 })) as BildTabelle;
    const zelle = tabelle.zeilen[4]?.[2];
    expect(zelle).toMatchObject({ text: "[unleserlich]", zustand: "unleserlich" });
    const werte = aktuelleZellen(tabelle, standFuer(null, null)).map((z) => z.map((x) => x.wert));
    const html = tabelleAlsHtml(werte, 1);
    const tsv = tabelleAlsTsv(werte);
    for (const ausgabe of [JSON.stringify(tabelle), html, tsv]) {
      expect(ausgabe).not.toContain("9,1");
    }
    expect(html).toContain("<td>[unleserlich]</td>");
    // Die Struktur bleibt: die Zelle steht in Zeile 5, Spalte 3 — die Nachbarn rücken nicht nach.
    expect(werte[4]).toEqual(["Filter", "12,5 kg", "[unleserlich]", "−0,4 %"]);
  });

  it("unsicher: [?wert] mit Zustand „unsicher“; Gegenlesung abweichend ebenso", () => {
    const tabelle = bildTabelleAusWoertern(kontrollierteTabelle({ "12,5": 45 })) as BildTabelle;
    expect(tabelle.zeilen[4]?.[1]).toMatchObject({ text: "[?12,5] kg", zustand: "unsicher" });
    const woerter = kontrollierteTabelle().map((w) =>
      w.text === "0,80" ? { ...w, abweichend: true as const } : w,
    );
    expect(bildTabelleAusWoertern(woerter)?.zeilen[2]?.[2]).toMatchObject({
      text: "[?0,80] €",
      zustand: "unsicher",
    });
  });

  it("mehrdeutige Zuordnung über eine Spaltengrenze wird gekennzeichnet, nicht verteilt", () => {
    const woerter = [
      wort("Posten", 20, 10),
      wort("Menge", 300, 10),
      wort("Preis", 560, 10),
      wort("Ventil", 20, 60),
      wort("4", 300, 60),
      wort("12,50", 560, 60),
      // Ein Block von Spalte 2 bis in Spalte 3 hinein.
      wort("Dichtung", 20, 110),
      wort("siehe", 330, 110),
      wort("Anlage", 440, 110),
      wort("7", 560, 110),
    ];
    const tabelle = bildTabelleAusWoertern(woerter);
    const zeile = tabelle?.zeilen[2];
    expect(zeile?.[1]).toMatchObject({ text: "siehe Anlage 7", mehrdeutig: true });
    expect(zeile?.[2]).toMatchObject({ text: "", zustand: "leer" });
  });

  it("nur EINE vollständige Zeile: kein Raster (kein Raten)", () => {
    expect(
      bildTabelleAusWoertern([
        wort("Posten", 20, 10),
        wort("Menge", 300, 10),
        wort("Ventil", 20, 60),
        wort("Dichtung", 20, 110),
      ]),
    ).toBeNull();
    expect(
      bildTabelleAusWoertern([
        wort("Vor", 20, 10),
        wort("der", 90, 10),
        wort("Wartung", 160, 10),
        wort("Ventil", 20, 60),
        wort("schließen.", 140, 60),
      ]),
    ).toBeNull();
  });

  // ── Nacharbeit 4 (Bens Befund): fehlende Wörter beweisen keine Leere ────────────────────────────
  /** Die kontrollierte Tabelle, in der die Engine die schwer lesbare „9,1“ GAR NICHT liefert. */
  const ohneSchwereZelle = (): OcrWort[] => kontrollierteTabelle().filter((w) => w.text !== "9,1");
  /** Der Prüfbereich der schweren Zelle (Zeile 5, Spalte 3), nach innen verkleinert. */
  const istSchwereZelle = (b: Bildbereich): boolean => b.x0 === 562 && b.y0 === 212;

  it("Tintenmaß: weißer Bereich 0, Rauschen 0, sichtbare Striche über der Schwelle", () => {
    const flaeche = (setze: (i: number) => number): Uint8ClampedArray => {
      const rgba = new Uint8ClampedArray(20 * 10 * 4);
      for (let i = 0; i < 200; i += 1) {
        const l = setze(i);
        rgba.set([l, l, l, 255], i * 4);
      }
      return rgba;
    };
    expect(
      tintenAnteil(
        flaeche(() => 255),
        20,
        10,
      ),
    ).toBe(0);
    expect(
      tintenAnteil(
        flaeche((i) => 255 - (i % 6)),
        20,
        10,
      ),
    ).toBe(0);
    // Blasse, unscharfe Schrift (Grau 200 auf Weiß) auf 10 von 200 Punkten.
    const blass = tintenAnteil(
      flaeche((i) => (i % 20 === 7 ? 200 : 255)),
      20,
      10,
    );
    expect(blass).toBeCloseTo(0.05);
    expect(blass).toBeGreaterThanOrEqual(TINTE_AB_ANTEIL);
    // Transparenz zählt als Weiß, nicht als Inhalt.
    expect(tintenAnteil(new Uint8ClampedArray(20 * 10 * 4), 20, 10)).toBe(0);
  });

  it("Inhalt ohne erkannte Wörter wird [unleserlich]; echte Leerzellen bleiben leer", () => {
    const tabelle = bildTabelleAusWoertern(ohneSchwereZelle()) as BildTabelle;
    expect(tabelle.zeilen[4]?.[2]?.zustand).toBe("leer");
    const bereiche = leereZellBereiche(tabelle);
    // Dichtung/Menge, Gehäuse × 3, Filter/Preis — zeilenweise.
    expect(bereiche).toHaveLength(5);
    expect(bereiche.filter(istSchwereZelle)).toHaveLength(1);
    const gemessen = markiereUnerkannteInhalte(
      tabelle,
      bereiche.map((b) => (istSchwereZelle(b) ? 0.05 : 0)),
    );
    expect(gemessen.zeilen[4]?.[2]).toEqual({
      text: "[unleserlich]",
      zustand: "unleserlich",
      mehrdeutig: false,
      rahmen: { x0: 560, y0: 210, x1: 676, y1: 240 },
    });
    expect(gemessen.zeilen[2]?.[1]?.zustand).toBe("leer");
    expect(gemessen.zeilen[3]?.slice(1).map((z) => z.zustand)).toEqual(["leer", "leer", "leer"]);
    // Kein Wert erfunden — weder im Raster noch in HTML/Tabulatortext.
    const werte = aktuelleZellen(gemessen, standFuer(null, null)).map((z) => z.map((x) => x.wert));
    expect(werte[4]).toEqual(["Filter", "12,5 kg", "[unleserlich]", "−0,4 %"]);
    expect(tabelleAlsTsv(werte).split("\n")[4]).toBe("Filter\t12,5 kg\t[unleserlich]\t−0,4 %");
    expect(normalizePastedHtml(tabelleAlsHtml(werte, gemessen.kopfzeilen))).toContain(
      "<tr><td>Filter</td><td>12,5 kg</td><td>[unleserlich]</td><td>−0,4 %</td></tr>",
    );
  });

  // Nacharbeit 5 (Bens Befund): eine fehlende Messung beweist keine Leere.
  it("nicht messbar (null) oder fehlendes Messergebnis: [ungeprüft], nie still leer", () => {
    const tabelle = bildTabelleAusWoertern(ohneSchwereZelle()) as BildTabelle;
    const bereiche = leereZellBereiche(tabelle);
    const ungeprueft = (zeile: number, spalte: number) => ({
      text: "[ungeprüft]",
      zustand: "ungeprueft",
      mehrdeutig: false,
      rahmen: tabelle.zeilen[zeile]?.[spalte]?.bereich,
    });
    const ohneWert = markiereUnerkannteInhalte(
      tabelle,
      bereiche.map(() => null),
    );
    for (const [z, s] of [
      [2, 1],
      [3, 1],
      [3, 2],
      [3, 3],
      [4, 2],
    ] as const) {
      expect(ohneWert.zeilen[z]?.[s], `Zelle ${z + 1}/${s + 1}`).toEqual(ungeprueft(z, s));
    }
    // Erkannte Inhalte bleiben unverändert.
    expect(ohneWert.zeilen[1]).toEqual(tabelle.zeilen[1]);
    expect(ohneWert.zeilen[4]?.[1]).toEqual(tabelle.zeilen[4]?.[1]);
    expect(ohneWert.kopfzeilen).toBe(1);

    // Nur zwei Ergebnisse für fünf Bereiche: die ersten zwei gemessen leer, der Rest ungeprüft.
    const teilweise = markiereUnerkannteInhalte(tabelle, [0, 0]);
    expect(teilweise.zeilen[2]?.[1]?.zustand).toBe("leer");
    expect(teilweise.zeilen[3]?.[1]?.zustand).toBe("leer");
    expect(teilweise.zeilen[3]?.[2]).toEqual(ungeprueft(3, 2));
    expect(teilweise.zeilen[4]?.[2]).toEqual(ungeprueft(4, 2));

    // Die Kennzeichnung reist in die Übernahme mit — Tabulatortext und Editor-HTML.
    const werte = aktuelleZellen(teilweise, standFuer(null, null)).map((z) => z.map((x) => x.wert));
    expect(tabelleAlsTsv(werte).split("\n")[4]).toBe("Filter\t12,5 kg\t[ungeprüft]\t−0,4 %");
    expect(tabelleAlsTsv(werte).split("\n")[2]).toBe("Dichtung\t\t0,80 €\t+1,2 %");
    const html = normalizePastedHtml(tabelleAlsHtml(werte, teilweise.kopfzeilen));
    expect(html).toContain(
      "<tr><td>Filter</td><td>12,5 kg</td><td>[ungeprüft]</td><td>−0,4 %</td></tr>",
    );
    expect(html).toContain("<tr><td>Dichtung</td><td></td><td>0,80 €</td><td>+1,2 %</td></tr>");
  });

  it("in der Automatik: die Messung bekommt das Bild und genau die Zellbereiche ohne Wörter", async () => {
    const messeTinte = vi.fn(async (_src: string, bereiche: readonly Bildbereich[]) =>
      bereiche.map((b) => (istSchwereZelle(b) ? 0.05 : 0)),
    );
    const bild = dataUrl(bildMit("T"));
    const analyse = createBildAnalyse({
      erkenne: async () => ({ status: "success", text: "Tabelle", woerter: ohneSchwereZelle() }),
      messeTinte,
    });
    const befund = await analyse.analysiereQuelle(einzelbildEingang("liste.png", bild), {
      automatik: true,
    });
    expect(messeTinte).toHaveBeenCalledTimes(1);
    expect(messeTinte.mock.calls[0]?.[0]).toBe(bild);
    expect(messeTinte.mock.calls[0]?.[1]).toHaveLength(5);
    const zellen = befund.befunde[0]?.bildTabelle?.zeilen;
    expect(zellen?.[4]?.[2]).toMatchObject({ text: "[unleserlich]", zustand: "unleserlich" });
    expect(zellen?.[2]?.[1]).toMatchObject({ text: "", zustand: "leer" });
    // Nacharbeit 5: eine fehlschlagende Messung bricht die Erkennung nicht ab — aber jede Zelle
    // ohne Wörter ist dann ungeprüft, nicht leer. Erkannte Zellen bleiben, wie sie sind.
    const fehlschlag = await createBildAnalyse({
      erkenne: async () => ({ status: "success", text: "Tabelle", woerter: ohneSchwereZelle() }),
      messeTinte: async () => {
        throw new Error("kein Canvas");
      },
    }).analysiereQuelle(einzelbildEingang("liste.png", bild), { automatik: true });
    expect(fehlschlag.befunde[0]?.status).toBe("gelesen");
    const nachFehler = fehlschlag.befunde[0]?.bildTabelle?.zeilen;
    expect(nachFehler?.[4]?.[2]).toMatchObject({ text: "[ungeprüft]", zustand: "ungeprueft" });
    expect(nachFehler?.[2]?.[1]).toMatchObject({ text: "[ungeprüft]", zustand: "ungeprueft" });
    expect(nachFehler?.[1]?.map((z) => z.text)).toEqual(["Ventil", "4 kg", "12,50 €", "-3,5 %"]);
    // Ohne Messweg ebenso.
    const ohneWeg = await createBildAnalyse({
      erkenne: async () => ({ status: "success", text: "Tabelle", woerter: ohneSchwereZelle() }),
    }).analysiereQuelle(einzelbildEingang("liste.png", bild), { automatik: true });
    expect(ohneWeg.befunde[0]?.bildTabelle?.zeilen[2]?.[1]?.zustand).toBe("ungeprueft");
  });

  it("Gitterlinien („|“) sind kein Zellinhalt", () => {
    const mitLinien = [
      ...kontrollierteTabelle(),
      wort("|", 240, 10),
      wort("|", 240, 60),
      wort("|", 240, 110),
    ];
    expect(texte(bildTabelleAusWoertern(mitLinien))).toEqual(ERWARTET);
  });
});

// ================================================================================================
// K4 · Übernahme/Kopieren erhält die Struktur im unterstützten Zielweg
// ================================================================================================
describe("K4 · Zwischenablage: HTML-Tabelle für den Editor und Tabulatortext", () => {
  const werte = ERWARTET.map((z) => [...z]);
  const inhalt = {
    html: tabelleAlsHtml(werte, 1, "Tabelle aus liste.png, Bild 1 (Texterkennung)"),
    text: tabelleAlsTsv(werte),
  };

  it("das HTML überlebt den Einfügeweg des Editors mit Kopf, Zeilen, Spalten und Herkunft", () => {
    const eingefuegt = normalizePastedHtml(inhalt.html);
    expect(eingefuegt).toContain(
      "<caption>Tabelle aus liste.png, Bild 1 (Texterkennung)</caption>",
    );
    expect(eingefuegt).toContain(
      "<thead><tr><th>Posten</th><th>Menge</th><th>Preis</th><th>Abweichung</th></tr></thead>",
    );
    expect(eingefuegt.match(/<tr>/g)).toHaveLength(5);
    expect(eingefuegt.match(/<td>/g)).toHaveLength(16);
    expect(eingefuegt).toBe(inhalt.html);
  });

  it("legt HTML UND Text in die Zwischenablage, wenn der Browser beides annimmt", async () => {
    const abgelegt: Record<string, Blob>[] = [];
    class Eintrag {
      constructor(readonly daten: Record<string, Blob>) {
        abgelegt.push(daten);
      }
    }
    const ablage = { write: vi.fn(async () => {}), writeText: vi.fn(async () => {}) };
    expect(await kopiereTabelle(ablage, inhalt, Eintrag)).toBe("tabelle");
    expect(ablage.writeText).not.toHaveBeenCalled();
    expect(await abgelegt[0]?.["text/html"]?.text()).toBe(inhalt.html);
    expect(await abgelegt[0]?.["text/plain"]?.text()).toBe(inhalt.text);
  });

  it("nimmt der Browser kein HTML an, sagt das Ergebnis „nur Text“ — sonst ehrlich nichts", async () => {
    class Eintrag {}
    const nurText = {
      write: vi.fn(async () => {
        throw new Error("NotAllowedError");
      }),
      writeText: vi.fn(async () => {}),
    };
    expect(await kopiereTabelle(nurText, inhalt, Eintrag)).toBe("nur-text");
    expect(nurText.writeText).toHaveBeenCalledWith(inhalt.text);
    expect(await kopiereTabelle(null, inhalt, Eintrag)).toBe("nicht-verfuegbar");
    expect(
      await kopiereTabelle(
        {
          writeText: async () => {
            throw new Error("x");
          },
        },
        inhalt,
      ),
    ).toBe("fehlgeschlagen");
  });
});

// ================================================================================================
// K6 · Quellenzuordnung, Quellwechsel, Wiederverwendung — an der echten Automatik
// ================================================================================================
describe("K6 · die Tabelle gehört zu genau ihrem Bild", () => {
  /** Nur das Bild mit Marke B ist eine Tabelle; die anderen sind einzelne Zeilen. */
  function tabellenEngine() {
    return vi.fn(async (src: string): Promise<OcrResult> => {
      if (markeAus(src) === "B") {
        return { status: "success", text: "Tabelle", woerter: kontrollierteTabelle() };
      }
      return {
        status: "success",
        text: "PRUEFKARTE 47",
        woerter: [wort("PRUEFKARTE", 20, 10), wort("47", 240, 10)],
      };
    });
  }

  it("PowerPoint: die Tabelle steht an Folie 2, Bild 1 — und nur dort", async () => {
    const pptx = await lesePptx(deck());
    // Die Leerzellen sind im Bild gemessen leer (sonst hießen sie „ungeprüft“, Nacharbeit 5).
    const analyse = createBildAnalyse({
      erkenne: tabellenEngine(),
      messeTinte: async (_src, bereiche) => bereiche.map(() => 0),
    });
    const befund = await analyse.analysiereQuelle(
      pptxBildEingang("wartung.pptx", pptx.html, pptx),
      { automatik: true },
    );
    const mitTabelle = befund.befunde.filter((b) => b.bildTabelle);
    expect(mitTabelle).toHaveLength(1);
    expect(mitTabelle[0]?.fundstelle).toMatchObject({
      quelle: "wartung.pptx",
      art: "pptx",
      folie: 2,
      bildAufFolie: 1,
    });
    expect(texte(mitTabelle[0]?.bildTabelle ?? null)).toEqual(ERWARTET);
    expect(mitTabelle[0]?.inhaltskennung).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("dieselben Bildbytes: dieselbe Tabelle ohne neue Erkennung", async () => {
    const erkenne = tabellenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const eingang = einzelbildEingang("liste.png", dataUrl(bildMit("B")));
    const erster = await analyse.analysiereQuelle(eingang, { automatik: true });
    const zweiter = await analyse.analysiereQuelle(eingang, { automatik: true });
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(zweiter.befunde[0]?.wiederverwendet).toBe(true);
    expect(zweiter.befunde[0]?.bildTabelle).toEqual(erster.befunde[0]?.bildTabelle);
  });

  it("Änderungen gehen nicht auf ein anderes oder verändertes Bild über", () => {
    const tabelle = bildTabelleAusWoertern(kontrollierteTabelle()) as BildTabelle;
    const stand = aendereZelle(tabelle, standFuer(null, "sha256:alt"), 1, 1, "5 kg");
    expect(standFuer(stand, "sha256:alt")).toBe(stand);
    const neu = standFuer(stand, "sha256:neu");
    expect(neu).toEqual({ inhaltskennung: "sha256:neu", aenderungen: {} });
    expect(aktuelleZellen(tabelle, neu)[1]?.[1]?.wert).toBe("4 kg");
  });
});

// ================================================================================================
// K6 · Nacharbeit 6 — die Tabelle am gelieferten OCR-E02-Weg (Berichtigung je Quelle und Bildfassung)
// ================================================================================================
describe("K6 · Tabelle und OCR-E02-Berichtigung: übernehmen, speichern, Quellwechsel", () => {
  /** Der Text, wie die Engine ihn zu den kontrollierten Wörtern liefert: eine Zeile je Bildzeile. */
  const ROH_TEXT = [
    "Wartungsliste",
    "Posten Menge Preis Abweichung",
    "Ventil 4 kg 12,50 € -3,5 %",
    "Dichtung 0,80 € +1,2 %",
    "Gehäuse",
    "Filter 12,5 kg 9,1 −0,4 %",
    "Stand Oktober, alle Angaben ohne Gewähr.",
  ].join("\n");

  async function tabellenQuelle(marke = "T", sonder: Partial<Record<string, number>> = {}) {
    const analyse = createBildAnalyse({
      erkenne: async () => ({
        status: "success",
        text: ROH_TEXT,
        woerter: kontrollierteTabelle(sonder),
      }),
      messeTinte: async (_src, bereiche) => bereiche.map(() => 0),
    });
    return analyse.analysiereQuelle(einzelbildEingang("liste.png", dataUrl(bildMit(marke))), {
      automatik: true,
    });
  }

  function korrektur(quelle: string, inhaltskennung: string, text: string): BildKorrekturDaten {
    return {
      quelle,
      inhaltskennung,
      ort: "b1",
      text,
      schritte: 0,
      geaendertAm: "2026-10-17T09:00:00.000Z",
    };
  }

  it("jede Zelle kennt die Wörter der Erkennung, aus denen sie besteht (Fundstelle je Zelle)", async () => {
    const b = (await tabellenQuelle()).befunde[0];
    const zellen = b?.bildTabelle?.zeilen;
    expect(zellen?.[1]?.[2]?.woerter).toEqual([8, 9]);
    expect(zellen?.[4]?.[2]?.woerter).toEqual([21]);
    expect(b?.woerter?.[8]?.text).toBe("12,50");
    expect(b?.woerter?.[21]?.text).toBe("9,1");
    // Leere Zellen haben keine Wörter, nur ihren Bereich im Bild.
    expect(zellen?.[2]?.[1]?.woerter).toBeUndefined();
    expect(zellen?.[2]?.[1]?.bereich).toBeDefined();
  });

  it("aus der Tabelle gespeichert: Block ersetzt genau die Tabellenzeilen und kommt zellgenau zurück", async () => {
    const b = (await tabellenQuelle()).befunde[0];
    const tabelle = b?.bildTabelle as BildTabelle;
    const vorher = structuredClone(tabelle);
    const werte = ERWARTET.map((z) => [...z]);
    (werte[2] as string[])[1] = "6 kg";
    (werte[4] as string[])[2] = "9,10 €";
    const text = berichtigungsText(b?.textGekennzeichnet ?? "", b?.woerter, tabelle, werte);
    expect(text.split("\n")).toEqual([
      "Wartungsliste",
      "Posten\tMenge\tPreis\tAbweichung",
      "Ventil\t4 kg\t12,50 €\t-3,5 %",
      "Dichtung\t6 kg\t0,80 €\t+1,2 %",
      "Gehäuse\t\t\t",
      "Filter\t12,5 kg\t9,10 €\t−0,4 %",
      "Stand Oktober, alle Angaben ohne Gewähr.",
    ]);

    const abgleich = tabelleMitBerichtigung(tabelle, text, b?.woerter);
    expect(abgleich.nichtZugeordnet).toEqual([]);
    expect(texte(abgleich.tabelle)).toEqual(werte);
    // Nur die geänderten Zellen sind berichtigt — mit dem, was die Erkennung geliefert hatte.
    expect(abgleich.tabelle.zeilen[2]?.[1]).toMatchObject({
      text: "6 kg",
      zustand: "sicher",
      berichtigt: { roh: "", rohZustand: "leer" },
    });
    expect(abgleich.tabelle.zeilen[4]?.[2]).toMatchObject({
      text: "9,10 €",
      woerter: [21],
      berichtigt: { roh: "9,1", rohZustand: "sicher" },
    });
    expect(abgleich.tabelle.zeilen[1]?.[1]).toBe(tabelle.zeilen[1]?.[1]);
    const ansicht = aktuelleZellen(abgleich.tabelle, standFuer(null, b?.inhaltskennung ?? null));
    expect(ansicht[2]?.[1]).toMatchObject({ berichtigt: true, roh: "", bearbeitet: false });
    expect(ansicht[1]?.[1]).toMatchObject({ berichtigt: false, roh: null });
    // Der Rohbefund bleibt, wie er war.
    expect(tabelle).toEqual(vorher);

    // Erneut gespeichert (zurück auf den erkannten Wert): genau der Block wird ersetzt.
    (werte[4] as string[])[2] = "9,1";
    const wieder = berichtigungsText(text, b?.woerter, tabelle, werte);
    expect(wieder.split("\n")).toHaveLength(7);
    expect(wieder.split("\n")[5]).toBe("Filter\t12,5 kg\t9,1\t−0,4 %");
    const zurueck = tabelleMitBerichtigung(tabelle, wieder, b?.woerter).tabelle;
    expect(zurueck.zeilen[4]?.[2]?.berichtigt).toBeUndefined();
    expect(zurueck.zeilen[2]?.[1]?.text).toBe("6 kg");
  });

  it("als freier Text berichtigt (OCR-E02): Wörter landen in ihrer Zelle; Ergänztes wird nicht geraten", async () => {
    const b = (await tabellenQuelle()).befunde[0];
    const tabelle = b?.bildTabelle as BildTabelle;
    const frei = ROH_TEXT.replace("12,50", "12,60").replace("Ventil 4", "Ventil ca. 4");
    const abgleich = tabelleMitBerichtigung(tabelle, frei, b?.woerter);
    expect(abgleich.tabelle.zeilen[1]?.[2]).toMatchObject({
      text: "12,60 €",
      berichtigt: { roh: "12,50 €" },
    });
    // „ca.“ hat kein erkanntes Wort — keine Zelle, sondern sichtbar „ohne Tabellenplatz“.
    expect(abgleich.nichtZugeordnet).toEqual(["ca."]);
    expect(texte(abgleich.tabelle).flat().join(" ")).not.toContain("ca.");
    expect(abgleich.tabelle.zeilen[1]?.[1]?.text).toBe("4 kg");

    // Daraus gespeichert: der Block ersetzt die Tabellenzeilen, „ca.“ bleibt als eigene Zeile.
    const werte = texte(abgleich.tabelle);
    const text = berichtigungsText(frei, b?.woerter, tabelle, werte);
    expect(text.split("\n")).toEqual([
      "Wartungsliste",
      "Posten\tMenge\tPreis\tAbweichung",
      "Ventil\t4 kg\t12,60 €\t-3,5 %",
      "Dichtung\t\t0,80 €\t+1,2 %",
      "Gehäuse\t\t\t",
      "Filter\t12,5 kg\t9,1\t−0,4 %",
      "ca.",
      "Stand Oktober, alle Angaben ohne Gewähr.",
    ]);
    expect(texte(tabelleMitBerichtigung(tabelle, text, b?.woerter).tabelle)).toEqual(werte);
  });

  it("unleserliche Zelle per Berichtigung gefüllt: der Wert der Person, der Rohzustand bleibt sichtbar", async () => {
    const b = (await tabellenQuelle("T", { "9,1": 20 })).befunde[0];
    const tabelle = b?.bildTabelle as BildTabelle;
    expect(tabelle.zeilen[4]?.[2]).toMatchObject({ text: "[unleserlich]", zustand: "unleserlich" });
    const frei = (b?.textGekennzeichnet ?? "").replace("[unleserlich]", "9,10");
    const zelle = tabelleMitBerichtigung(tabelle, frei, b?.woerter).tabelle.zeilen[4]?.[2];
    expect(zelle).toMatchObject({
      text: "9,10",
      zustand: "sicher",
      berichtigt: { roh: "[unleserlich]", rohZustand: "unleserlich" },
    });
    // Ohne Berichtigung bleibt sie unleserlich — die Tabelle erfindet keinen Wert.
    const ohne = tabelleMitBerichtigung(tabelle, b?.textGekennzeichnet ?? "", b?.woerter);
    expect(ohne.tabelle.zeilen[4]?.[2]).toMatchObject({ text: "[unleserlich]" });
    expect(ohne.tabelle.zeilen[4]?.[2]?.berichtigt).toBeUndefined();
  });

  it("Quellwechsel: dieselbe Berichtigung gilt nur an derselben Quelle UND Bildfassung", async () => {
    const q = await tabellenQuelle();
    const b = q.befunde[0];
    const kennung = b?.inhaltskennung ?? "";
    const tabelle = b?.bildTabelle as BildTabelle;
    const werte = ERWARTET.map((z) => [...z]);
    (werte[1] as string[])[1] = "5 kg";
    const text = berichtigungsText(b?.textGekennzeichnet ?? "", b?.woerter, tabelle, werte);
    // Die Quelle eines Einzelbildes ist `<Präfix>|<Dateiname>` (lib/bildKorrektur.ts).
    const liste = [korrektur("entwurf:e1|liste.png", kennung, text)];

    const hier = quellenMitKorrekturen([q], "entwurf:e1", liste)[0]?.befunde[0];
    expect(hier?.korrektur).toBeDefined();
    // Der Rohbefund samt Tabelle bleibt; die Tabelle wird erst in der Ansicht abgeglichen.
    expect(hier?.bildTabelle).toBe(tabelle);
    const abgleich = tabelleMitBerichtigung(tabelle, hier?.text ?? "", hier?.woerter);
    expect(abgleich.tabelle.zeilen[1]?.[1]).toMatchObject({ text: "5 kg", berichtigt: {} });

    // Andere Quelle (anderer Entwurf), gleiches Bild: keine Übertragung.
    const andereQuelle = quellenMitKorrekturen([q], "entwurf:e2", liste)[0]?.befunde[0];
    expect(andereQuelle?.korrektur).toBeUndefined();
    expect(andereQuelle?.text).toBe(ROH_TEXT);
    // Gleiche Quelle, anderes Bild (andere Bytes): keine Übertragung.
    const verandert = await tabellenQuelle("U");
    expect(verandert.befunde[0]?.inhaltskennung).not.toBe(kennung);
    const anderesBild = quellenMitKorrekturen([verandert], "entwurf:e1", liste)[0]?.befunde[0];
    expect(anderesBild?.korrektur).toBeUndefined();
    expect(texte(anderesBild?.bildTabelle ?? null)[1]?.[1]).toBe("4 kg");
  });
});
