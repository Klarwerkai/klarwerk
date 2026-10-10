// ================================================================================================
// R-0347 · FRAGEN AN EIN HOCHGELADENES DOKUMENT — der Kern `apps/web/src/lib/dokumentFragen.ts`.
// ================================================================================================
//
// Gemessen wird der Zielzustand im Originalwortlaut, in seinen drei Teilen:
//   A · „Man lädt ein Dokument hoch" — die drei Leser der Fläche (PDF über die ECHTE pdfjs-Engine,
//       Word über das ECHTE mammoth, Markdown/Text) ergeben nummerierte Fundstellen.
//   B · „die Antwort verknüpft die Inhalte" — eine Frage, deren Begriffe an verschiedenen Stellen
//       stehen, bekommt diese Stellen ZUSAMMEN, in Dokumentreihenfolge.
//   C · „und verweist auf die Fundstelle im Dokument" — jede Aussage ist ein wörtlicher Auszug aus
//       genau der Stelle, auf die ihre Marke zeigt (Seite/Abschnitt/Absatz).
// Dazu die Ehrlichkeitsregeln aus EF-6: keine Antwort ohne tragende Stelle (D).
//
// Der Bedienweg im echten Browser steht in `tests-smoke/dokumentfragen-browser.spec.ts`.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractDocxRich } from "../../apps/web/src/lib/docx";
import {
  type DokumentAntwort,
  type Fundstelle,
  bausteineAusHtml,
  bausteineAusSeiten,
  bausteineAusText,
  beantworte,
  gliedere,
} from "../../apps/web/src/lib/dokumentFragen";
import { type PdfEngine, extractPdfDocument } from "../../apps/web/src/lib/pdf";
import { referenzBytes } from "../d3-dateien-durchgaengig/referenzinhalt";

const require = createRequire(import.meta.url);

/** Der `legacy`-Build von pdfjs — derselbe, den `lib/files.ts` im Browser lädt (wie R5 in D3). */
async function echtePdfEngine(): Promise<PdfEngine> {
  const pdfjs = (await import(
    "../../apps/web/node_modules/pdfjs-dist/legacy/build/pdf.mjs"
  )) as unknown as PdfEngine & { GlobalWorkerOptions?: { workerSrc: string } };
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
      "../../apps/web/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
  }
  return { getDocument: (src) => pdfjs.getDocument(src) };
}

function alsArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const kopie = new Uint8Array(bytes.byteLength);
  kopie.set(bytes);
  return kopie.buffer;
}

/** Jede Aussage ist WÖRTLICH aus ihrer Fundstelle — Teil für Teil, ohne Kürzungszeichen. */
function erwarteWoertlich(antwort: DokumentAntwort): void {
  for (const a of antwort.aussagen) {
    for (const teil of a.zitat.replace(/ …$/, "").split(" … ")) {
      expect(a.fundstelle.text, `nicht wörtlich aus Stelle ${a.fundstelle.nummer}`).toContain(teil);
    }
  }
}

// Ein Betriebshandbuch mit drei Abschnitten. Die Begriffe der Fragen unten stehen absichtlich in
// VERSCHIEDENEN Abschnitten, damit Verknüpfen und Fundstelle getrennt messbar sind.
const HANDBUCH = [
  "# Wartung",
  "",
  "Vor jeder Wartung wird der Hauptschalter ausgeschaltet und gegen Wiedereinschalten gesichert.",
  "",
  "Das Wartungsintervall beträgt 500 Betriebsstunden. Danach wird das Protokoll unterschrieben.",
  "",
  "# Filter",
  "",
  "Der Filter wird alle 200 Betriebsstunden gewechselt. Benutzte Filter gehören in den Sondermüll.",
  "",
  "# Reinigung",
  "",
  "Die Oberflächen werden täglich mit Reiniger R7 abgewischt.",
  "",
  "Nach der Reinigung bleibt die Anlage zehn Minuten aus.",
].join("\n");

const stellenHandbuch = (): Fundstelle[] => gliedere(bausteineAusText(HANDBUCH));

describe("R-0347 · A — ein hochgeladenes Dokument wird zu nummerierten Fundstellen", () => {
  it("A1 · Markdown/Text: Überschriften werden Abschnitt, Absätze werden Fundstellen je Abschnitt", () => {
    const stellen = stellenHandbuch();
    expect(stellen.map((s) => [s.nummer, s.abschnitt, s.absatz])).toEqual([
      [1, "Wartung", 1],
      [2, "Wartung", 2],
      [3, "Filter", 1],
      [4, "Reinigung", 1],
      [5, "Reinigung", 2],
    ]);
    expect(stellen.every((s) => s.seite === null)).toBe(true);
    expect(stellen[1]?.text).toBe(
      "Das Wartungsintervall beträgt 500 Betriebsstunden. Danach wird das Protokoll unterschrieben.",
    );
  });

  it("A2 · PDF-Seiten: die Absatzzählung beginnt je Seite neu, die Seite steht an der Stelle", () => {
    const stellen = gliedere(
      bausteineAusSeiten(["Erster Absatz.\n\nZweiter Absatz.", "", "Dritte Seite, ein Absatz."]),
    );
    expect(stellen.map((s) => [s.nummer, s.seite, s.absatz])).toEqual([
      [1, 1, 1],
      [2, 1, 2],
      [3, 3, 1],
    ]);
  });

  it("A3 · Word-HTML: h1–h6 sind Abschnitte, Listenpunkte Absätze, eine Tabellenzeile EINE Stelle", () => {
    const html =
      "<h2>Prüfung</h2><p>Erst die Sichtprüfung &amp; dann die Probe.</p>" +
      "<ul><li>Ventil prüfen</li><li>Dichtung tauschen</li></ul>" +
      "<table><tr><td><p>Pruefschritt</p></td><td><p>Ergebnis</p></td></tr>" +
      "<tr><td><p>Ventilprobe</p></td><td><p>bestanden</p></td></tr></table>";
    const stellen = gliedere(bausteineAusHtml(html));
    expect(stellen.map((s) => [s.abschnitt, s.absatz, s.text])).toEqual([
      ["Prüfung", 1, "Erst die Sichtprüfung & dann die Probe."],
      ["Prüfung", 2, "Ventil prüfen"],
      ["Prüfung", 3, "Dichtung tauschen"],
      ["Prüfung", 4, "Pruefschritt | Ergebnis"],
      ["Prüfung", 5, "Ventilprobe | bestanden"],
    ]);
  });

  it("A4 · die ECHTE PDF-Referenz über pdfjs: Seitentext liegt vor, die Fundstelle nennt Seite 1", async () => {
    const pdf = await extractPdfDocument(
      alsArrayBuffer(referenzBytes("pdf")),
      await echtePdfEngine(),
    );
    expect(pdf.pages, "der PDF-Leser liefert keine Seitentexte").toHaveLength(1);
    // Der Gesamttext bleibt zeichengleich die Verbindung der Seiten — keine zweite Wahrheit.
    expect(pdf.text).toBe(pdf.pages?.[0]);

    const stellen = gliedere(bausteineAusSeiten(pdf.pages ?? []));
    const antwort = beantworte("Wo steht der Suchbegriff PDFBELEG4203?", stellen);
    expect(antwort.beantwortet).toBe(true);
    const [aussage] = antwort.aussagen;
    expect(aussage?.fundstelle.seite).toBe(1);
    expect(aussage?.zitat).toContain("PDFBELEG4203 kommt in dieser Datei genau einmal vor.");
    erwarteWoertlich(antwort);
  }, 60_000);

  it("A5 · die ECHTE Word-Datei über mammoth: der Satz wird gefunden und als Absatz 1 belegt", async () => {
    const bytes = readFileSync(resolve(process.cwd(), "tests/fixtures/sample.docx"));
    const word = await extractDocxRich(alsArrayBuffer(bytes));
    const stellen = gliedere(bausteineAusHtml(word.html));
    expect(stellen.length).toBeGreaterThan(0);

    const antwort = beantworte("Was tun bei Überdruck?", stellen);
    expect(antwort.beantwortet).toBe(true);
    expect(antwort.aussagen[0]?.zitat).toContain("Ventil bei Überdruck schließen");
    expect(antwort.aussagen[0]?.fundstelle.absatz).toBe(1);
    erwarteWoertlich(antwort);
  });

  it("A6 · die ECHTE Markdown-Referenz: Abschnittsüberschrift und Absatz stimmen", () => {
    const stellen = gliedere(bausteineAusText(referenzBytes("markdown").toString("utf8")));
    const antwort = beantworte("Was passiert mit dem Hauptschalter?", stellen);
    expect(antwort.beantwortet).toBe(true);
    const [aussage] = antwort.aussagen;
    expect(aussage?.fundstelle.abschnitt).toBe("Abschnitt Eins Wartung");
    expect(aussage?.zitat).toContain("Vor der Wartung wird der Hauptschalter ausgeschaltet");
  });

  it("A7 · Markdown-Listenpunkte und Tabellenzeilen sind je eine Stelle, der Tabellenstrich bleibt in der Zelle", () => {
    const stellen = gliedere(bausteineAusText(referenzBytes("markdown").toString("utf8")));
    const texte = stellen.map((s) => [s.abschnitt, s.text]);
    expect(texte).toContainEqual([
      "Abschnitt Eins Wartung",
      "Erster Aufzaehlungspunkt der Referenz",
    ]);
    expect(texte).toContainEqual(["Abschnitt Zwei Pruefung", "Ventilprobe | bestanden"]);
    expect(texte).toContainEqual(["Abschnitt Zwei Pruefung", "Ventil A|B | geprueft"]);
    expect(texte.some(([, text]) => text?.includes("---"))).toBe(false);
  });
});

describe("R-0347 · B — die Antwort verknüpft die Inhalte", () => {
  it("B1 · Begriffe aus zwei Abschnitten → zwei Stellen, in Dokumentreihenfolge, je mit eigenen Begriffen", () => {
    const antwort = beantworte(
      "Wann wird der Filter gewechselt und wann ist das Wartungsintervall?",
      stellenHandbuch(),
    );
    expect(antwort.beantwortet).toBe(true);
    expect(antwort.aussagen.map((a) => a.fundstelle.nummer)).toEqual([2, 3]);
    expect(antwort.aussagen[0]?.begriffe).toContain("Wartungsintervall");
    expect(antwort.aussagen[1]?.begriffe).toContain("Filter");
    expect(antwort.nichtGefunden).toEqual([]);
    erwarteWoertlich(antwort);
  });

  it("B2 · ein Wort trifft auch im Kompositum: „Wartung“ findet „Wartungsintervall“", () => {
    const antwort = beantworte("Wartung", stellenHandbuch());
    expect(antwort.aussagen.map((a) => a.fundstelle.nummer)).toEqual([1, 2]);
  });

  it("B3 · Umlaute und Umschrift sind dasselbe Wort: „Oberflaechen“ findet „Oberflächen“", () => {
    const antwort = beantworte("Oberflaechen reinigen", stellenHandbuch());
    expect(antwort.aussagen[0]?.fundstelle.abschnitt).toBe("Reinigung");
  });

  // Die Obergrenze ist modulintern (`MAX_ANTWORT_STELLEN = 4`); der Fall hält sie von außen fest.
  it("B4 · nie mehr als vier Stellen — eine Antwort ist keine Trefferliste", () => {
    const absaetze = Array.from({ length: 12 }, (_, i) => `Absatz ${i + 1} nennt den Filter.`);
    const antwort = beantworte("Filter", gliedere(bausteineAusText(absaetze.join("\n\n"))));
    expect(antwort.aussagen.length).toBe(4);
  });
});

describe("R-0347 · C — jede Aussage verweist auf ihre Fundstelle, wörtlich", () => {
  // BEN, Nacharbeit 2: hier stand die Erwartung, das Zitat sei allein „Danach wird das Protokoll
  // unterschrieben." — ein Satz, der verschweigt, WONACH. Der grüne Fall bestätigte das Fehlverhalten.
  // Der kurze Absatz wird jetzt vollständig zitiert; die 500 Betriebsstunden gehören zur Antwort.
  it("C1 · ein kurzer Absatz wird vollständig zitiert — der Bezugssatz zu „Danach“ fehlt nicht", () => {
    const antwort = beantworte("Wann wird das Protokoll unterschrieben?", stellenHandbuch());
    const [aussage] = antwort.aussagen;
    expect(aussage?.fundstelle).toMatchObject({ nummer: 2, abschnitt: "Wartung", absatz: 2 });
    expect(aussage?.zitat).toBe(
      "Das Wartungsintervall beträgt 500 Betriebsstunden. Danach wird das Protokoll unterschrieben.",
    );
    expect(aussage?.gekuerzt).toBe(false);
    erwarteWoertlich(antwort);
  });

  it("C3 · im langen Absatz nimmt ein Satz mit Bezugswort („Danach …“) seinen Vorgängersatz mit", () => {
    const fuell = "Die Anlage steht in Halle drei und wird von zwei Schichten bedient. ".repeat(6);
    const lang = `${fuell}Das Ventil wird nach 300 Stunden getauscht. Danach wird der Druck geprüft. ${fuell}`;
    const antwort = beantworte("Wann wird der Druck geprüft?", gliedere(bausteineAusText(lang)));
    const [aussage] = antwort.aussagen;
    expect(aussage?.zitat).toBe(
      "Das Ventil wird nach 300 Stunden getauscht. Danach wird der Druck geprüft.",
    );
    expect(aussage?.gekuerzt).toBe(true);
    erwarteWoertlich(antwort);
  });

  it("C2 · eine sehr lange Stelle wird für das Zitat gekürzt und als gekürzt gemeldet", () => {
    const lang = `Der Filter ${"wird sorgfältig und mit Bedacht ".repeat(30)}gewechselt.`;
    const antwort = beantworte("Filter", gliedere(bausteineAusText(lang)));
    const [aussage] = antwort.aussagen;
    expect(aussage?.gekuerzt).toBe(true);
    expect(aussage?.zitat.endsWith(" …")).toBe(true);
    erwarteWoertlich(antwort);
  });
});

describe("R-0347 · D — ehrliche Lücke statt Auffüllen", () => {
  it("D1 · steht es nicht im Dokument, gibt es keine Aussage — und der Begriff wird genannt", () => {
    const antwort = beantworte("Wer ist der Lieferant der Kaffeemaschine?", stellenHandbuch());
    expect(antwort).toEqual({
      beantwortet: false,
      grund: "nichts-gefunden",
      aussagen: [],
      nichtGefunden: ["Lieferant", "Kaffeemaschine"],
    });
  });

  it("D2 · trägt das Dokument weniger als die Hälfte der Begriffe, ist es eine Lücke", () => {
    const antwort = beantworte("Filter Lieferant Kaffeemaschine", stellenHandbuch());
    expect(antwort.beantwortet).toBe(false);
    expect(antwort.aussagen).toEqual([]);
  });

  it("D3 · ein Teil fehlt, der Rest trägt: Antwort MIT Nennung des Fehlenden", () => {
    const antwort = beantworte("Filter Sondermüll Lieferant", stellenHandbuch());
    expect(antwort.beantwortet).toBe(true);
    expect(antwort.nichtGefunden).toEqual(["Lieferant"]);
  });

  it("D4 · eine Frage nur aus Füllwörtern sucht nichts", () => {
    expect(beantworte("Was ist das?", stellenHandbuch())).toEqual({
      beantwortet: false,
      grund: "frage-ohne-begriffe",
      aussagen: [],
      nichtGefunden: [],
    });
  });

  it("D5 · kurze Begriffe treffen nur als ganzes Wort: „Tor“ trifft nicht „Faktoren“", () => {
    const stellen = gliedere(bausteineAusText("Die Faktoren werden gezählt."));
    expect(beantworte("Tor", stellen).beantwortet).toBe(false);
  });
});
