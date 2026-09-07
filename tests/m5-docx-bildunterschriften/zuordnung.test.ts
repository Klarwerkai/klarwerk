// ================================================================================================
// JOB 3210 · M5c — WORD-BILDUNTERSCHRIFTEN ÜBERLEBEN DEN DOCX-IMPORT
// ================================================================================================
//
// DER BEFUND, den diese Datei rot gemacht hat und der jetzt grün ist (Codex, Paket
// M5-DOCX-BILDUNTERSCHRIFTEN-20260907, gemessen an der freigegebenen BAADER-Arbeitskopie, Entwurf
// 35605815-ec52-499a-b58c-c2dbb6e18d70): Zehn Bilder kamen im gespeicherten Entwurf an, die
// Beschriftungen „Figure 1: Profiles" bis „Figure 9: Transitions, key surfaces" ebenfalls — aber
// als gewöhnliche Nachbarabsätze. ALLE ZEHN `figcaption` waren LEER (frischer GET, payload.bodyHtml).
// Damit findet die Bildsuche (M5/JOB 3095), die ihre Suchtexte aus `figcaption` ableitet
// (`services/structure/src/captions.ts`), kein einziges dieser Bilder über seine Originalbeschriftung.
//
// GEMESSEN WIRD AM ECHTEN WEG, nicht an einer Hilfsfunktion:
//
//     synthetische .docx (jszip, echtes OOXML)  →  extractDocxRich mit dem ECHTEN mammoth
//        →  wholeDocumentBodyHtml  →  sanitizeHtml (der autoritative Server-Sanitizer)
//        →  imageCaptionEntries / searchCaptionTexts (die Suchableitung der Bildsuche)
//
// Kein injizierter `DocxEngine` — die Frage ist ja gerade, was mammoth aus echter Word-Struktur
// macht. Ein Fake würde genau das wegdefinieren. Der Weg bis SPEICHERN/GET über die echte Route
// steht in `route.test.ts` daneben.
//
// KEINE ECHTDATEN: alle Dokumente sind erfunden und im Test erzeugt. Die BAADER-Kopie kommt
// ausdrücklich nicht ins Testrepository (Paket §Befund).
import { describe, expect, it } from "vitest";
import { wholeDocumentBodyHtml } from "../../apps/web/src/lib/captureFromFile";
import { MAX_INLINE_BODY_HTML_BYTES, extractDocxRich } from "../../apps/web/src/lib/docx";
import { sanitizeHtml } from "../../services/structure";
import { imageCaptionEntries } from "../../services/structure/src/captions";
import { type Absatz, PNG_BLAU, PNG_ROT, alsPuffer, baueDocx } from "./docx-bauen";

/** Der Platzhaltertext, den `files.ts` im Betrieb durchreicht — sein Text landet nie im Body (WP-D10). */
const PLATZHALTER = "Bildbeschreibung hinzufügen";

interface Befund {
  readonly html: string;
  readonly captionsAssigned: number;
  readonly captionsAmbiguous: number;
  /** Die Fussnoten des Rumpfes: Bildkennung → Text. Leere Fussnoten stehen NICHT drin (Scannervertrag). */
  readonly fussnoten: ReadonlyMap<string, string>;
  /** Die Bildkennungen in Dokumentreihenfolge — so ist „das erste Bild" belegbar. */
  readonly bildIds: readonly string[];
  /** Die Bilddaten je Bildkennung — so ist „das RICHTIGE Bild" belegbar. */
  readonly bilddaten: ReadonlyMap<string, string>;
}

/** Bildkennungen und Bilddaten aus den `<img>`-Marken, in Dokumentreihenfolge. */
function bilder(html: string): { ids: string[]; daten: Map<string, string> } {
  const ids: string[] = [];
  const daten = new Map<string, string>();
  for (const t of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = t[0];
    const id = /\bdata-image-id="([^"]+)"/.exec(tag)?.[1] ?? "";
    const src = /\bsrc="data:image\/[a-zA-Z0-9.+-]+;base64,([^"]+)"/.exec(tag)?.[1] ?? "";
    ids.push(id);
    daten.set(id, src);
  }
  return { ids, daten };
}

/** Ein Dokument durch den echten Importer und den echten Server-Sanitizer. */
async function importiere(absaetze: readonly Absatz[]): Promise<Befund> {
  const { bytes } = await baueDocx(absaetze);
  const reich = await extractDocxRich(alsPuffer(bytes), {
    mapImage: async (s) => s,
    imageCaptionPlaceholder: PLATZHALTER,
    imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
  });
  const persistiert = sanitizeHtml(
    wholeDocumentBodyHtml({
      fileName: "pruefdokument.docx",
      text: reich.text,
      html: reich.html,
      sourceKind: "docx",
      locale: "de",
    }),
  );
  const { ids, daten } = bilder(persistiert);
  const fussnoten = new Map<string, string>();
  for (const e of imageCaptionEntries(persistiert)) {
    if (e.imageId !== null) {
      fussnoten.set(e.imageId, e.text);
    }
  }
  return {
    html: persistiert,
    captionsAssigned: reich.captionsAssigned,
    captionsAmbiguous: reich.captionsAmbiguous,
    fussnoten,
    bildIds: ids,
    bilddaten: daten,
  };
}

/** Wie oft steht dieser Text im gespeicherten Rumpf? Für „nicht doppelt dargestellt". */
function vorkommen(html: string, text: string): number {
  return html.split(text).length - 1;
}

// ================================================================================================
// K · KALIBRIERUNG — ohne sie misst der ganze Lauf nichts
// ================================================================================================
// Ein Lauf, der gar kein Bild und gar keinen Beschriftungstext ins Dokument bekommt, erfüllt jede
// „die Fussnote ist gefüllt"-Zusicherung mühelos falsch-grün, sobald sie über eine leere Menge
// läuft. Zuerst wird deshalb belegt, dass die Prüfdatei wirklich trägt, was sie behauptet.
describe("JOB 3210 · K · die Prüfvorrichtung trägt wirklich Word-Struktur", () => {
  it("K1 · die erzeugte .docx ist ein Zip mit Dokument, Formatvorlagen und Bildteil", async () => {
    const { bytes } = await baueDocx([
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    for (const teil of ["word/document.xml", "word/styles.xml", "word/media/bild1.png"]) {
      expect(bytes.includes(Buffer.from(teil)), `Der Teil ${teil} fehlt im Zip`).toBe(true);
    }
    // Und der Beschriftungsabsatz trägt wirklich eine Formatvorlage, nicht bloss Text.
    const JSZip = (await import("jszip")).default;
    const doc = await (await JSZip.loadAsync(bytes)).file("word/document.xml")?.async("string");
    expect(doc ?? "", "Der Beschriftungsabsatz trägt kein w:pStyle").toContain(
      '<w:pStyle w:val="Caption"/>',
    );
    const stile = await (await JSZip.loadAsync(bytes)).file("word/styles.xml")?.async("string");
    expect(stile ?? "", "Die Vorlage heisst nicht wie Words eingebaute Beschriftung").toContain(
      '<w:name w:val="caption"/>',
    );
  });

  it("K2 · das Bild kommt an, und zwar mit seinen eigenen Bytes", async () => {
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    expect(b.bildIds, "Es kam kein einziges Bild an").toHaveLength(1);
    expect(b.bilddaten.get(b.bildIds[0] ?? "")).toBe(PNG_ROT);
  });
});

// ================================================================================================
// A · DER GEMESSENE FALL — Beschriftung NACH dem Bild
// ================================================================================================
describe("JOB 3210 · A · eine Beschriftung NACH dem Bild landet in der Fussnote", () => {
  it("A1 · die figcaption trägt die Originalbeschriftung im Wortlaut", async () => {
    const b = await importiere([
      { art: "text", text: "Der Rahmen wird aus zwei Profilen gefügt." },
      { art: "bild", png: PNG_ROT, alt: "profiles.png" },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    const id = b.bildIds[0] ?? "";
    expect(
      b.fussnoten.get(id),
      "Die Fussnote des Bildes ist leer — genau der gemessene BAADER-Befund",
    ).toBe("Figure 1: Profiles");
    expect(b.captionsAssigned).toBe(1);
    expect(b.captionsAmbiguous).toBe(0);
  });

  it("A2 · die Beschriftung steht EINMAL da, nicht zweimal und nicht gar nicht", async () => {
    // Der Auftrag verlangt beides zugleich (§5.1): nicht doppelt dargestellt UND nicht still
    // entfernt. Sie wandert deshalb aus dem Fliesstext in die Fussnote desselben Bildes.
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    expect(
      vorkommen(b.html, "Figure 1: Profiles"),
      "Der Wortlaut steht nicht genau einmal im Rumpf",
    ).toBe(1);
    expect(
      b.html,
      "Die Beschriftung steht noch als eigener Absatz daneben — sie wird doppelt dargestellt",
    ).not.toContain("<p>Figure 1: Profiles</p>");
  });

  it("A2b · eine ausgezeichnete Beschriftung behält ihre Auszeichnung", async () => {
    // „Originalwortlaut bleibt" heisst auch: der Fettdruck der Word-Beschriftung bleibt. Er
    // überlebt zusätzlich den Server-Sanitizer (`strong` ist in `figcaption` erlaubt), und die
    // Suchableitung liest denselben Text wie bei der unausgezeichneten Fassung.
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      {
        art: "beschriftung",
        text: "Figure 1: Profiles",
        laeufe: [{ text: "Figure 1", fett: true }, { text: ": Profiles" }],
      },
    ]);
    const id = b.bildIds[0] ?? "";
    expect(b.html).toContain(
      `<figcaption data-image-id="${id}"><strong>Figure 1</strong>: Profiles</figcaption>`,
    );
    expect(b.fussnoten.get(id), "Die Suchableitung liest den ausgezeichneten Text anders").toBe(
      "Figure 1: Profiles",
    );
  });

  it("A3 · die Stilmarke der Erkennung verlässt den Rumpf nicht", async () => {
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: "Figure 1: Profiles" },
      { art: "beschriftung", text: "Ganz allein, ohne Bild" },
    ]);
    expect(b.html, "Die interne Marke der Stilkarte steht im gespeicherten Rumpf").not.toContain(
      "kw-docx-caption",
    );
    // Und die nicht zugeordnete Beschriftung bleibt als Absatz stehen — sie geht nicht verloren.
    expect(b.html).toContain("Ganz allein, ohne Bild");
  });

  it("A4 · zwei Bilder mit je eigener Beschriftung bekommen JE IHRE eigene", async () => {
    // Das ist die Zusicherung gegen „irgendeine Beschriftung an irgendein Bild": geprüft wird die
    // BINDUNG von Bilddaten und Text, nicht bloss die Anwesenheit beider.
    const b = await importiere([
      { art: "bild", png: PNG_ROT, alt: "profiles.png" },
      { art: "beschriftung", text: "Figure 1: Profiles" },
      { art: "text", text: "Dazwischen steht ein ganzer Satz." },
      { art: "bild", png: PNG_BLAU, alt: "bolted.png" },
      { art: "beschriftung", text: "Figure 2: Bolted connection" },
    ]);
    const [rot, blau] = b.bildIds;
    expect(b.bilddaten.get(rot ?? "")).toBe(PNG_ROT);
    expect(b.bilddaten.get(blau ?? "")).toBe(PNG_BLAU);
    expect(b.fussnoten.get(rot ?? "")).toBe("Figure 1: Profiles");
    expect(b.fussnoten.get(blau ?? "")).toBe("Figure 2: Bolted connection");
    expect(b.captionsAssigned).toBe(2);
  });
});

// ================================================================================================
// B · BESCHRIFTUNG VOR DEM BILD
// ================================================================================================
describe("JOB 3210 · B · eine Beschriftung ÜBER dem Bild wird ebenso zugeordnet", () => {
  it("B1 · ein einzelnes Bild mit Beschriftung davor", async () => {
    const b = await importiere([
      { art: "beschriftung", text: "Abbildung 4: Schweissnaht" },
      { art: "bild", png: PNG_BLAU },
    ]);
    expect(b.fussnoten.get(b.bildIds[0] ?? "")).toBe("Abbildung 4: Schweissnaht");
    expect(b.captionsAssigned).toBe(1);
  });

  it("B2 · zwei Bildabschnitte mit Beschriftung darüber bekommen JE IHRE eigene", async () => {
    // Jede der beiden Beschriftungen hat genau einen Nachbarlauf — vor ihr steht Fliesstext, hinter
    // ihr ihr Bild. Das ist die Eindeutigkeit, die zählt; die Seite (oben/unten) spielt keine Rolle.
    const b = await importiere([
      { art: "text", text: "Zuerst die Schweissnaht." },
      { art: "beschriftung", text: "Abbildung 4: Schweissnaht" },
      { art: "bild", png: PNG_ROT },
      { art: "text", text: "Danach die Schraubverbindung." },
      { art: "beschriftung", text: "Abbildung 5: Schraubverbindung" },
      { art: "bild", png: PNG_BLAU },
    ]);
    const [erst, zweit] = b.bildIds;
    expect(b.bilddaten.get(erst ?? "")).toBe(PNG_ROT);
    expect(b.bilddaten.get(zweit ?? "")).toBe(PNG_BLAU);
    expect(b.fussnoten.get(erst ?? "")).toBe("Abbildung 4: Schweissnaht");
    expect(b.fussnoten.get(zweit ?? "")).toBe("Abbildung 5: Schraubverbindung");
    expect(b.captionsAssigned).toBe(2);
    expect(b.captionsAmbiguous).toBe(0);
  });

  it("B3 · eine Beschriftung DIREKT zwischen zwei Bildern gehört keinem — auch bei klarer Hausordnung", async () => {
    // KORREKTURPFLICHT 1 DES PRÜFERS ZU RUNDE 1, und der Pflicht-Gegenfall der Steuerung vom
    // 07.09. 08:35. Runde 1 erhob aus den eindeutigen Fällen eine „Ausrichtung des Dokuments" und
    // liess sie den mehrdeutigen Fall entscheiden. Hier stehen DREI eindeutige Beschriftungen über
    // ihren Bildern — jede Mehrheitszählung wäre erdrückend „oben" — und danach eine Legende
    // zwischen zwei Einzelbildern. Sie darf NICHT durch die Mehrheit sicher werden: eine
    // Konvention ist keine Herkunft. Beide Fussnoten bleiben leer, beide Bilder sind gezählt.
    const absaetze: Absatz[] = [];
    for (let i = 1; i <= 3; i += 1) {
      absaetze.push({ art: "text", text: `Zum Abschnitt ${i} gehört eine Ansicht.` });
      absaetze.push({ art: "beschriftung", text: `Abbildung ${i}: Ansicht ${i}` });
      absaetze.push({ art: "bild", png: i % 2 === 0 ? PNG_BLAU : PNG_ROT });
    }
    absaetze.push({ art: "text", text: "Der Anhang zeigt zwei Details." });
    absaetze.push({ art: "bild", png: PNG_ROT, alt: "detail-a.png" });
    absaetze.push({ art: "beschriftung", text: "Abbildung 4: Offen" });
    absaetze.push({ art: "bild", png: PNG_BLAU, alt: "detail-b.png" });

    const b = await importiere(absaetze);
    expect(b.bildIds, "Es kamen nicht fünf Bilder an").toHaveLength(5);
    expect(b.captionsAssigned, "Die Mehrheit hat doch entschieden").toBe(3);
    expect(b.captionsAmbiguous, "Die Unklarheit der letzten beiden Bilder fehlt").toBe(2);
    for (const id of b.bildIds.slice(3)) {
      expect(b.fussnoten.get(id), `Bild ${id} hat die mehrdeutige Legende bekommen`).toBe(
        undefined,
      );
    }
    // Und die offene Legende steht weiter im Fliesstext — sie ist nicht still verschwunden.
    expect(b.html).toContain("Abbildung 4: Offen");
  });
});

// ================================================================================================
// C · LEERABSÄTZE TRENNEN NICHT
// ================================================================================================
describe("JOB 3210 · C · ein Leerabsatz zwischen Bild und Beschriftung ändert nichts", () => {
  it("C1 · Bild, Leerabsatz, Beschriftung — genau die gemessene BAADER-Reihenfolge", async () => {
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "leer" },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    expect(
      b.fussnoten.get(b.bildIds[0] ?? ""),
      "Ein Leerabsatz hat die Beschriftung vom Bild getrennt",
    ).toBe("Figure 1: Profiles");
  });

  it("C2 · auch zwei Leerabsätze trennen nicht", async () => {
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "leer" },
      { art: "leer" },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    expect(b.fussnoten.get(b.bildIds[0] ?? "")).toBe("Figure 1: Profiles");
  });

  it("C3 · ein VOLLER Absatz dazwischen trennt sehr wohl", async () => {
    // Die Gegenprobe zu C1/C2. Wäre der Trenner egal, wäre jeder Nachbartext eine Beschriftung.
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "text", text: "Ein ganzer Satz steht dazwischen." },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    expect(
      b.fussnoten.get(b.bildIds[0] ?? ""),
      "Über einen Fliesstextabsatz hinweg zugeordnet",
    ).toBe(undefined);
    expect(b.captionsAssigned).toBe(0);
  });
});

// ================================================================================================
// D · MEHRDEUTIGKEIT BLEIBT MEHRDEUTIG — der Kern des Auftrags
// ================================================================================================
describe("JOB 3210 · D · zwei Bilder unter EINER Legende bekommen beide nichts", () => {
  it("D1 · beide Fussnoten bleiben leer, und die Unklarheit ist gezählt", async () => {
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "bild", png: PNG_BLAU },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    for (const id of b.bildIds) {
      expect(
        b.fussnoten.get(id),
        `Bild ${id} hat eine Beschriftung bekommen, die genauso gut dem anderen gehören könnte`,
      ).toBe(undefined);
    }
    expect(b.captionsAssigned, "Es wurde doch zugeordnet").toBe(0);
    expect(b.captionsAmbiguous, "Die Unklarheit wird nicht gezählt").toBe(2);
    // Und die Legende ist NICHT verschwunden: sie steht weiter als Absatz da.
    expect(b.html, "Die mehrdeutige Legende wurde still entfernt").toContain("Figure 1: Profiles");
  });

  it("D2 · auch ein Leerabsatz zwischen den beiden Bildern hebt die Mehrdeutigkeit nicht auf", async () => {
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "leer" },
      { art: "bild", png: PNG_BLAU },
      { art: "leer" },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    expect(b.captionsAssigned).toBe(0);
    expect(b.captionsAmbiguous).toBe(2);
  });

  it("D4 · eine EINZELNE Legende zwischen zwei Bildern gehört keinem von beiden", async () => {
    // Die Legende könnte zum Bild darüber oder zu dem darunter gehören; das Dokument sagt es nicht.
    // Beide bleiben leer, beide sind als offene Frage gezählt. B3 zeigt daneben, dass auch eine
    // dokumentweite Konvention diesen Fall NICHT auflöst.
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: "Figure 1: Profiles" },
      { art: "bild", png: PNG_BLAU },
    ]);
    expect(b.captionsAssigned, "Es wurde geraten, welches Bild gemeint ist").toBe(0);
    expect(b.captionsAmbiguous).toBe(2);
    expect(b.html).toContain("Figure 1: Profiles");
  });

  it("D3 · die Figure-NUMMER ordnet nichts zu — zehn Bilder, neun Legenden", async () => {
    // Genau der Fall des Demodokuments. Wer „Bild n = Figure n" rechnet, hängt hier ab dem
    // zehnten Bild eine falsche Legende an — oder verschiebt gleich alle um eins.
    // JEDER Bildabschnitt steht für sich (Fliesstext davor): so ist jede der neun Legenden für
    // sich eindeutig, und die Zusicherung misst wirklich die NUMMER und nicht die Nachbarschaft.
    // Die ununterbrochene Kette ohne Fliesstext ist der andere Fall — sie steht in D5.
    const absaetze: Absatz[] = [];
    for (let i = 1; i <= 9; i += 1) {
      absaetze.push({ art: "text", text: `Abschnitt ${i} beschreibt eine Sicht.` });
      absaetze.push({ art: "bild", png: i % 2 === 0 ? PNG_BLAU : PNG_ROT });
      absaetze.push({ art: "leer" });
      absaetze.push({ art: "beschriftung", text: `Figure ${i}: Sicht ${i}` });
    }
    // Das zehnte Bild hat KEINE Legende — es steht am Ende, hinter einem Fliesstextabsatz.
    absaetze.push({ art: "text", text: "Zum Schluss noch eine Übersicht ohne Beschriftung." });
    absaetze.push({ art: "bild", png: PNG_ROT });

    const b = await importiere(absaetze);
    expect(b.bildIds, "Es kamen nicht zehn Bilder an").toHaveLength(10);
    expect(b.captionsAssigned, "Nicht genau die neun beschrifteten Bilder wurden zugeordnet").toBe(
      9,
    );
    expect(b.captionsAmbiguous).toBe(0);
    for (let i = 1; i <= 9; i += 1) {
      expect(b.fussnoten.get(b.bildIds[i - 1] ?? ""), `Bild ${i} trägt die falsche Legende`).toBe(
        `Figure ${i}: Sicht ${i}`,
      );
    }
    expect(
      b.fussnoten.get(b.bildIds[9] ?? ""),
      "Das zehnte Bild hat eine erfundene Beschriftung bekommen",
    ).toBe(undefined);
  });

  it("D5 · eine ununterbrochene Kette Bild–Legende–Bild–Legende liefert GAR KEINE Zuordnung", async () => {
    // DER PREIS DER EHRLICHKEIT, ausgeschrieben statt beschönigt. Ohne trennenden Fliesstext hat
    // jede Legende zwei Bildnachbarn und jedes Bild zwei Legendennachbarn. Ein Mensch läse die
    // Kette mühelos; belegt ist sie nicht. Der Code sagt deshalb, was er weiss: nichts — alle
    // Fussnoten leer, alle betroffenen Bilder offen, alle Legenden noch im Fliesstext.
    const absaetze: Absatz[] = [];
    for (let i = 1; i <= 3; i += 1) {
      absaetze.push({ art: "bild", png: i % 2 === 0 ? PNG_BLAU : PNG_ROT });
      absaetze.push({ art: "leer" });
      absaetze.push({ art: "beschriftung", text: `Figure ${i}: Kette ${i}` });
    }
    const b = await importiere(absaetze);
    expect(b.bildIds).toHaveLength(3);
    // Das letzte Bild der Kette hat nur EINEN Legendennachbarn (Figure 3), aber Figure 3 hat zwei
    // Bildnachbarn — auch das ist keine Eindeutigkeit.
    expect(b.captionsAssigned, "In der Kette wurde doch zugeordnet").toBe(0);
    expect(b.captionsAmbiguous, "Die drei offenen Bilder sind nicht gezählt").toBe(3);
    for (let i = 1; i <= 3; i += 1) {
      expect(b.html, `Legende ${i} wurde still entfernt`).toContain(`Figure ${i}: Kette ${i}`);
    }
  });
});

// ================================================================================================
// E · KEIN NACHBARTEXT WIRD ZUR BESCHRIFTUNG
// ================================================================================================
describe("JOB 3210 · E · ein Bild ohne Beschriftung bleibt ehrlich leer", () => {
  it("E1 · der Nachbarsatz wird NICHT übernommen", async () => {
    const b = await importiere([
      { art: "text", text: "Die Baugruppe wird von unten verschraubt." },
      { art: "bild", png: PNG_ROT },
      { art: "text", text: "Anschliessend wird die Naht geprüft." },
    ]);
    expect(
      b.fussnoten.get(b.bildIds[0] ?? ""),
      "Ein beliebiger Nachbarabsatz ist als Bildunterschrift gelandet",
    ).toBe(undefined);
    expect(b.captionsAssigned).toBe(0);
    expect(b.captionsAmbiguous, "Ein Bild ganz ohne Anwärter ist keine offene Frage").toBe(0);
    // Beide Sätze stehen unverändert im Fliesstext.
    expect(b.html).toContain("Die Baugruppe wird von unten verschraubt.");
    expect(b.html).toContain("Anschliessend wird die Naht geprüft.");
  });

  it("E2 · ein Verweissatz mit Figure-Nummer ist ein Satz und keine Beschriftung", async () => {
    // Die Grenze der Nummern-Erkennung, und sie ist bewusst eng: nach der Nummer muss ein
    // Beschriftungstrenner stehen. Ein blosses Leerzeichen macht jeden Verweissatz zur Legende.
    const b = await importiere([
      { art: "bild", png: PNG_ROT },
      { art: "text", text: "Figure 4 shows the profile of the frame in detail." },
    ]);
    expect(
      b.fussnoten.get(b.bildIds[0] ?? ""),
      "Ein Verweissatz wurde als Bildunterschrift übernommen",
    ).toBe(undefined);
    expect(b.html).toContain("Figure 4 shows the profile of the frame in detail.");
  });

  it("E3 · ein Bild OHNE jede Beschriftung behält die leere Fussnote samt Anker", async () => {
    // Rückwärtskompatibilität, wörtlich: es verhält sich wie vor diesem Job. Der Anker ist da,
    // der Inhalt ist leer, und der Editor zeigt dafür wie bisher seinen Platzhalter.
    const b = await importiere([{ art: "bild", png: PNG_ROT }]);
    const id = b.bildIds[0] ?? "";
    expect(id).toMatch(/^kw-img-/);
    expect(b.html).toContain(`<figcaption data-image-id="${id}"></figcaption>`);
    expect(b.html, "Der Platzhaltertext ist im Rumpf gelandet (WP-D10)").not.toContain(PLATZHALTER);
  });
});

// ================================================================================================
// F · DIE NUTZENKETTE — die Suchableitung sieht die Originalbeschriftung
// ================================================================================================
describe("JOB 3210 · F · das Ergebnis erreicht die Bildsuche", () => {
  it("F1 · die Suchableitung liefert die Originalbeschriftung mit der RICHTIGEN Bildkennung", async () => {
    // Das ist der Lieferpunkt 4: nicht „irgendwo steht der Text", sondern der Vertrag, auf dem
    // JOB 3095 aufsetzt — Fussnotentext MIT Anker, und der Anker zeigt auf das richtige Bild.
    const b = await importiere([
      { art: "bild", png: PNG_ROT, alt: "profiles.png" },
      { art: "leer" },
      { art: "beschriftung", text: "Figure 1: Profiles" },
      { art: "text", text: "Der zweite Fall betrifft die Verschraubung." },
      { art: "bild", png: PNG_BLAU, alt: "bolted.png" },
      { art: "leer" },
      { art: "beschriftung", text: "Figure 6: Bolted connection" },
    ]);
    const eintraege = imageCaptionEntries(b.html);
    expect(eintraege.map((e) => e.text)).toEqual([
      "Figure 1: Profiles",
      "Figure 6: Bolted connection",
    ]);
    // Und die HERKUNFT stimmt: der Anker des Treffers zeigt auf das Bild mit den richtigen Bytes.
    const profiles = eintraege[0]?.imageId ?? "";
    const bolted = eintraege[1]?.imageId ?? "";
    expect(b.bilddaten.get(profiles), "Der Profiles-Treffer zeigt auf das falsche Bild").toBe(
      PNG_ROT,
    );
    expect(
      b.bilddaten.get(bolted),
      "Der Bolted-connection-Treffer zeigt auf das falsche Bild",
    ).toBe(PNG_BLAU);
  });
});

// ================================================================================================
// H · DIE STRUKTUR DES ORIGINALS, IN EINEM ZUSAMMENHÄNGENDEN DOKUMENT
// ================================================================================================
// Nachgestellt nach der Präzisierung 2 der Steuerung (07.09. 08:51, Codex 420721a0, aus dem
// GELESENEN BAADER-Original, `baader-bildstruktur.json`): ein Abbildungsverzeichnis, dessen Einträge
// mit „Figure n:" beginnen; ein sauber beschrifteter Bildabschnitt; eine Legende NACH ZWEI Bildern
// (im Original „Figure 6"); eine Folge Bild–Legende–Bild (im Original „Bolted connection" und
// Figure 7–9); und eine VERWAISTE Schlusslegende am gekürzten Dokumentende ohne Bild („Figure 10").
// Die Einzelregeln stehen oben je für sich — hier stehen sie zusammen in EINER Datei, weil das
// Original sie auch zusammen enthält und weil sich Regeln erst im Zusammenspiel widersprechen.
// KEINE ECHTDATEN: Texte und Bilder sind erfunden, nur die ANORDNUNG ist die gemeldete.
describe("JOB 3210 · H · ein Dokument mit allen gemeldeten Eigenheiten zugleich", () => {
  it("H1 · Verzeichnis, sauberer Abschnitt, Doppelbild, Bild–Legende–Bild und verwaiste Schlusslegende", async () => {
    const b = await importiere([
      // Das Abbildungsverzeichnis. Seine Einträge sehen aus wie Legenden — der erste trägt sogar
      // die Beschriftungs-Formatvorlage. An keinem steht ein Bild, also ist keiner eine Legende.
      { art: "ueberschrift", text: "Abbildungsverzeichnis" },
      { art: "beschriftung", text: "Figure 1: Profiles" },
      { art: "text", text: "Figure 6: Bolted connection" },
      { art: "text", text: "Figure 7: Transitions, key surfaces" },
      { art: "text", text: "Der folgende Teil beschreibt den Rahmenbau." },
      // Ein sauber beschrifteter Abschnitt: genau ein Bild, genau eine Legende daneben.
      { art: "text", text: "Der Rahmen wird aus zwei Profilen gefügt." },
      { art: "bild", png: PNG_ROT, alt: "profiles.png" },
      { art: "leer" },
      { art: "beschriftung", text: "Figure 1: Profiles" },
      // ZWEI Bilder, danach EINE Legende (im Original: Figure 6 folgt auf zwei Bilder).
      { art: "text", text: "Die Verschraubung ist in zwei Ansichten dargestellt." },
      { art: "bild", png: PNG_BLAU, alt: "bolted-a.png" },
      { art: "bild", png: PNG_ROT, alt: "bolted-b.png" },
      { art: "leer" },
      { art: "beschriftung", text: "Figure 6: Bolted connection" },
      // Bild – Legende – Bild.
      { art: "text", text: "Die Übergänge folgen unmittelbar aufeinander." },
      { art: "bild", png: PNG_BLAU, alt: "trans-a.png" },
      { art: "beschriftung", text: "Figure 7: Transitions, key surfaces" },
      { art: "bild", png: PNG_ROT, alt: "trans-b.png" },
      // Die verwaiste Schlusslegende des gekürzten Dokuments — ohne Bild.
      { art: "text", text: "Hier endet der gekürzte Auszug." },
      { art: "beschriftung", text: "Figure 10: Overview" },
    ]);

    expect(b.bildIds, "Es kamen nicht fünf Bilder an").toHaveLength(5);
    // (a) Verzeichniseinträge sind keine Legenden; nur der Abschnitt am Bild wird zugeordnet.
    expect(b.captionsAssigned, "Nicht genau das eine eindeutige Bild wurde zugeordnet").toBe(1);
    expect(b.fussnoten.get(b.bildIds[0] ?? "")).toBe("Figure 1: Profiles");
    expect(b.bilddaten.get(b.bildIds[0] ?? ""), "Der Treffer zeigt auf das falsche Bild").toBe(
      PNG_ROT,
    );
    // Der Verzeichniseintrag steht noch da — der Wortlaut kommt zweimal vor: Verzeichnis + Fussnote.
    expect(
      vorkommen(b.html, "Figure 1: Profiles"),
      "Der Verzeichniseintrag wurde verschluckt oder die Legende steht doppelt",
    ).toBe(2);

    // (c)+(d) Doppelbild und Bild–Legende–Bild: vier offene Bilder, keine Fussnote gefüllt.
    expect(b.captionsAmbiguous, "Die vier offenen Bilder sind nicht gezählt").toBe(4);
    for (const id of b.bildIds.slice(1)) {
      expect(b.fussnoten.get(id), `Bild ${id} hat eine geratene Legende bekommen`).toBe(undefined);
    }

    // (b) Die verwaiste Schlusslegende bleibt erhalten und erzeugt kein Bild und keinen Verlust.
    expect(b.html, "Die verwaiste Schlusslegende wurde still entfernt").toContain(
      "Figure 10: Overview",
    );
    expect((b.html.match(/<img\b/g) ?? []).length, "Die Bildzahl hat sich verändert").toBe(5);
    // Und die beiden mehrdeutigen Legenden stehen weiter im Fliesstext, je zweimal im Dokument
    // (Verzeichniseintrag + Legende am Bild) — nichts wurde in eine Fussnote gezogen.
    expect(vorkommen(b.html, "Figure 6: Bolted connection")).toBe(2);
    expect(vorkommen(b.html, "Figure 7: Transitions, key surfaces")).toBe(2);
  });
});

// ================================================================================================
// G · VERTRÄGLICHKEIT — was NICHT anders werden darf
// ================================================================================================
describe("JOB 3210 · G · der übrige Importweg bleibt, wie er war", () => {
  it("G1 · Überschriften, Fliesstext und Bildkennungen sind unverändert", async () => {
    const b = await importiere([
      { art: "ueberschrift", text: "Rahmenbau" },
      { art: "text", text: "Der Rahmen besteht aus zwei Profilen." },
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    // h1 → h2 (Sanitizer-Subset) wie bisher.
    expect(b.html).toContain("<h2>Rahmenbau</h2>");
    expect(b.html).toContain("Der Rahmen besteht aus zwei Profilen.");
    expect(b.bildIds[0] ?? "").toMatch(/^kw-img-[a-z0-9]{6}-1$/);
  });

  it("G2 · ohne Bild-Fussnoten (kein imageCaptionPlaceholder) bleibt der Rumpf zeichengleich", async () => {
    // Der Zweig, den `frontDoorBodyFromDraft` und die Klartextpfade fahren: keine Stilkarte, keine
    // Zuordnung, kein verschobener Absatz. Wäre das anders, hätte dieser Job stillschweigend
    // fremde Wege verändert.
    const { bytes } = await baueDocx([
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    const ohne = await extractDocxRich(alsPuffer(bytes), { mapImage: async (s) => s });
    expect(ohne.html).toContain("<p>Figure 1: Profiles</p>");
    expect(ohne.html, "Die interne Stilmarke ist in einen fremden Zweig gelaufen").not.toContain(
      "kw-docx-caption",
    );
    expect(ohne.captionsAssigned).toBe(0);
    expect(ohne.captionsAmbiguous).toBe(0);
  });

  it("G3 · das Byte-Budget droppt Bild UND gefüllte Fussnote gemeinsam", async () => {
    // Die Notbremse arbeitet auf der BILDEINHEIT `<figure>…</figure>`. Sie muss die jetzt gefüllte
    // Fussnote genauso mitnehmen wie die leere — sonst bliebe ein Beschriftungstext ohne Bild
    // stehen und behauptete etwas über nichts.
    const { bytes } = await baueDocx([
      { art: "text", text: "Ein kurzer Satz." },
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: "Figure 1: Profiles" },
    ]);
    const eng = await extractDocxRich(alsPuffer(bytes), {
      mapImage: async (s) => s,
      imageCaptionPlaceholder: PLATZHALTER,
      imageBudgetBytes: 200, // reicht für den Text, nicht für das Bild
    });
    expect(eng.droppedImages, "Das Bild wurde trotz zu kleinem Budget behalten").toBe(1);
    expect(eng.html, "Die Beschriftung blieb ohne ihr Bild zurück").not.toContain(
      "Figure 1: Profiles",
    );
    expect(eng.html).toContain("Ein kurzer Satz.");
    // Und der Zähler ist ehrlich das, was er sagt: die ZUORDNUNG hat stattgefunden — dass die
    // Notbremse das Bild danach fallen liess, ist eine andere Zahl (`droppedImages`).
    expect(eng.captionsAssigned).toBe(1);
  });
});
