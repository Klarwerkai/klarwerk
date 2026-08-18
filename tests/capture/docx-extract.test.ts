import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Nur der DOM-freie DOCX-Kern wird getestet — kein Import aus `files.ts` (DOM),
// kein `new File(...)`. So bleibt der Root-/Node-Typecheck DOM-frei.
// JOB 1115: `captureFromFile` und `services/structure` sind ebenfalls DOM-frei (belegt: sie stehen
// seit WP-D1 in `tests/structure/docx-rich-import.test.ts` in derselben Node-Umgebung) — der
// DOM-freie Vertrag dieser Datei bleibt damit unangetastet.
import {
  wholeDocumentBodyHtml,
  wholeDocumentDraftPayload,
} from "../../apps/web/src/lib/captureFromFile";
import {
  type DocxEngine,
  extractDocxRich,
  extractDocxText,
  isDocxDocumentLike,
} from "../../apps/web/src/lib/docx";
import { sanitizeHtml } from "../../services/structure";

// FR-CAP-06: DOCX wird client-seitig zu Klartext extrahiert (mammoth, lazy).
const here = dirname(fileURLToPath(import.meta.url));

// Buffer in eine frische Kopie übertragen → echtes `ArrayBuffer` (nicht SharedArrayBuffer).
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return copy.buffer;
}

describe("FR-CAP-06: DOCX-Extraktion", () => {
  it("liest den Klartext aus einer .docx", async () => {
    const buf = await readFile(join(here, "..", "fixtures", "sample.docx"));
    const text = await extractDocxText(toArrayBuffer(buf));
    expect(text).toContain("Ventil bei Überdruck schließen");
  });

  it("erkennt .docx über Name/MIME, nicht aber .pdf oder .txt", () => {
    expect(isDocxDocumentLike({ name: "anleitung.docx" })).toBe(true);
    expect(
      isDocxDocumentLike({
        name: "ohne-endung",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe(true);
    expect(isDocxDocumentLike({ name: "bericht.pdf" })).toBe(false);
    expect(isDocxDocumentLike({ name: "notiz.txt", type: "text/plain" })).toBe(false);
  });
});

// ================================================================================================
// JOB 1115 · D-042 + D-043 — DIE BEIDEN NACHBEARBEITUNGSSCHRITTE DERSELBEN KETTE
// ================================================================================================
//
// DER BEFUND, wörtlich aus `DESIGN_AN_CHEF/LIEFERUNG-20260815-BLOCK3.md`, live gemessen am Import
// von „Project equipment design guide Rev. 0.91 b short.docx" (Weg *Ganzes Dokument*):
//
//   D-042: Der erzeugte Entwurf beginnt mit fünf Absätzen, die kein Wissen sind, sondern
//          Dokumentenrahmen — „BAADER" · „Design guide" · „Project equipment" · „en" ·
//          „BAADER project equipment design guide | Rev. 0.9 | EN". Die Zeile „en" ist ein
//          Sprachkürzel als eigener Absatz im Wissenskörper. Wer diesen Entwurf einreicht,
//          veröffentlicht Kopfzeilen als Wissen.
//   D-043: Derselbe Import erzeugt 116 Links — „1 Foreword information 5" → `href="#_Toc235424890"`,
//          Word-interne Sprungmarken samt Seitenzahlen, die es im Web nicht gibt; zwei Links tragen
//          gar kein Ziel. Der Nutzer sieht ein klickbares Inhaltsverzeichnis, das nichts tut.
//
// Ursache beider: `lib/docx.ts` reicht die mammoth-Ausgabe durch und bearbeitet sie nur an
// definierten Stellen nach (`mapDocxHeadings`, `wrapImagesInFigures`) — eine Bereinigung von
// Rahmenzeilen und eine Nachbearbeitung der Anker gab es nicht.
//
// GEMESSEN WIRD AM ECHTEN PRODUKTPFAD, nicht am Quelltext: die injizierte Engine (Hausmuster aus
// `tests/structure/docx-rich-import.test.ts`) liefert mammoth-förmiges HTML, danach läuft die
// ECHTE Kette `extractDocxRich` → `wholeDocumentBodyHtml` → `sanitizeHtml` (der autoritative
// Server-Sanitizer). Erst dahinter steht, was ein Nutzer wirklich einreichen würde.

const RAHMEN = ["BAADER", "Design guide", "Project equipment", "en"];
const KOPFZEILE = "BAADER project equipment design guide | Rev. 0.9 | EN";
const SATZ = "Das Ventil schliesst bei Überdruck automatisch.";

const rahmenBlock = (): string => `${RAHMEN.map((z) => `<p>${z}</p>`).join("")}<p>${KOPFZEILE}</p>`;

/** Ein Dokument wie das gemessene: Rahmen, Inhaltsverzeichnis, Wissen — und der Rahmen kehrt wieder. */
const AUS_WORD = [
  rahmenBlock(),
  '<p><a href="#_Toc235424890">1 Foreword information 5</a></p>',
  '<p><a href="#_Toc235424891">2 Scope 7</a></p>',
  "<p><a>3 Ohne Ziel 9</a></p>",
  "<h1>Foreword information</h1>",
  `<p>${SATZ}</p>`,
  '<p>Siehe <a href="https://example.org/norm">die Norm</a>.</p>',
  // Die Wiederkehr weiter unten ist der BELEG, dass es Rahmenzeilen sind — ohne sie bliebe es
  // Vermutung, und der Schritt bleibt bewusst konservativ.
  rahmenBlock(),
].join("");

const AUS_WORD_TEXT = [
  ...RAHMEN,
  KOPFZEILE,
  "1 Foreword information 5",
  "2 Scope 7",
  "3 Ohne Ziel 9",
  "Foreword information",
  SATZ,
  "Siehe die Norm.",
  ...RAHMEN,
  KOPFZEILE,
].join("\n");

function engineFuer(html: string, text: string): DocxEngine {
  return {
    convertToHtml: async () => ({ value: html, messages: [] }),
    extractRawText: async () => ({ value: text, messages: [] }),
  };
}

const wordEngine = engineFuer(AUS_WORD, AUS_WORD_TEXT);

/** Der Wissenskörper OHNE den vorangestellten Quellenvermerk — dort darf kein Rahmen stehen. */
function koerperVorErsterUeberschrift(html: string): string {
  const i = html.indexOf("<h2>");
  return i < 0 ? html : html.slice(0, i);
}

describe("JOB 1115 · A1 · Kalibrierung: die Vorrichtung misst wirklich den Importweg", () => {
  it("die Fixtur trägt tatsächlich Rahmenzeilen, Sprungmarken und einen zielloser Link", () => {
    // Ohne diesen Fall wäre jede Zusicherung unten überbestimmt: eine Fixtur ohne Befund
    // erfüllt sie alle, ohne dass das Produkt irgendetwas leistet.
    expect(AUS_WORD).toContain("<p>en</p>");
    expect((AUS_WORD.match(/href="#_Toc/gi) ?? []).length).toBe(2);
    expect((AUS_WORD.match(/<a(?![^>]*\bhref=)[^>]*>/gi) ?? []).length).toBe(1);
    expect(AUS_WORD).toContain('href="https://example.org/norm"');
  });
});

describe("JOB 1115 · A2 · D-042: Rahmenzeilen sind kein Wissen mehr", () => {
  it("der Wissenskörper beginnt mit dem ersten echten Inhalt, nicht mit BAADER / Design guide / en", async () => {
    const { html } = await extractDocxRich(new ArrayBuffer(4), { engine: wordEngine });
    const kopf = koerperVorErsterUeberschrift(html);
    for (const zeile of [...RAHMEN, KOPFZEILE]) {
      expect(
        kopf,
        `Die Rahmenzeile „${zeile}" steht als eigener Absatz im Wissenskörper — wer diesen Entwurf einreicht, veröffentlicht eine Kopfzeile als Wissen.`,
      ).not.toContain(`<p>${zeile}</p>`);
    }
  });

  it("was entfernt wurde, ist im Quellenvermerk nachlesbar — nichts geht verloren", async () => {
    const { html, frameLines } = await extractDocxRich(new ArrayBuffer(4), { engine: wordEngine });
    expect(frameLines, "Die entfernten Rahmenzeilen werden nicht berichtet").toEqual([
      ...RAHMEN,
      KOPFZEILE,
    ]);
    // GEPRÜFT WIRD DER VERMERK SELBST, nicht das blosse Vorkommen im Dokument. Ein `toContain` über
    // das ganze HTML wäre hier wertlos: dieselben Zeilen kehren weiter unten im Fließtext wieder,
    // und die Zusicherung bliebe auch dann grün, wenn die Bewahrung ersatzlos entfiele. Genau das
    // ist an einer ersten Fassung dieses Falls gemessen worden — er zählte nicht.
    expect(
      html.startsWith("<blockquote>"),
      "Der Wissenskörper beginnt nicht mit dem Vermerk — die entfernten Zeilen sind weggeworfen",
    ).toBe(true);
    const vermerk = html.slice(0, html.indexOf("</blockquote>") + "</blockquote>".length);
    for (const zeile of frameLines) {
      expect(
        vermerk,
        `„${zeile}" steht nicht im Vermerk — sie ist ersatzlos verschwunden`,
      ).toContain(zeile);
    }
  });

  it("kein Satz mit Satzzeichen wird entfernt", async () => {
    const { html } = await extractDocxRich(new ArrayBuffer(4), { engine: wordEngine });
    expect(html).toContain(SATZ);
  });

  it("die spätere Wiederkehr der Rahmenzeilen im Fließtext bleibt unangetastet", async () => {
    // Entfernt wird ausschliesslich der Block VOR der ersten Überschrift. Was weiter unten steht,
    // ist Fließtext und wird nicht angefasst — sonst schnitte der Schritt in echtes Wissen.
    const { html } = await extractDocxRich(new ArrayBuffer(4), { engine: wordEngine });
    const nachUeberschrift = html.slice(html.indexOf("<h2>"));
    expect(nachUeberschrift).toContain("<p>BAADER</p>");
  });
});

describe("JOB 1115 · A3 · D-043: das Inhaltsverzeichnis führt nicht mehr ins Leere", () => {
  it("kein Link mit #_Toc-Ziel und kein Link ohne Ziel überlebt", async () => {
    const { html } = await extractDocxRich(new ArrayBuffer(4), { engine: wordEngine });
    expect(
      html.match(/href="#_Toc/gi) ?? [],
      "Word-interne Sprungmarken sind noch da — im Web zeigen sie auf nichts",
    ).toEqual([]);
    expect(
      html.match(/<a(?![^>]*\bhref=)[^>]*>/gi) ?? [],
      "Ein Link ganz ohne Ziel ist noch da — er sieht klickbar aus und tut nichts",
    ).toEqual([]);
  });

  it("der Text des Inhaltsverzeichnisses bleibt vollständig lesbar, Seitenzahlen inklusive", async () => {
    const { html } = await extractDocxRich(new ArrayBuffer(4), { engine: wordEngine });
    expect(html).toContain("1 Foreword information 5");
    expect(html).toContain("2 Scope 7");
    expect(html).toContain("3 Ohne Ziel 9");
  });

  it("externe Links bleiben anklickbar", async () => {
    const { html } = await extractDocxRich(new ArrayBuffer(4), { engine: wordEngine });
    expect(html).toContain('<a href="https://example.org/norm">die Norm</a>');
  });

  it("Bildfußnoten-Anker bleiben unberührt", async () => {
    // D-043 fasst ausschliesslich `<a>` an. Der Fußnoten-Anker der Bilder ist eine `figcaption`
    // mit `data-image-id` — er darf von diesem Schritt nichts merken.
    const mitBild = engineFuer(
      `<h1>Titel</h1><p>Ein Satz.</p><img src="data:image/png;base64,QQ==">`,
      "Titel\nEin Satz.",
    );
    const { html } = await extractDocxRich(new ArrayBuffer(4), {
      engine: mitBild,
      mapImage: async (s) => s,
      imageCaptionPlaceholder: "x",
      imageRunToken: "abc123",
    });
    expect(html).toContain('<figcaption data-image-id="kw-img-abc123-1"></figcaption>');
  });
});

describe("JOB 1115 · A4 · Ein Dokument ohne Rahmenzeilen bleibt zeichengleich", () => {
  it("ohne Rahmen und ohne Inhaltsverzeichnis ist die Ausgabe Zeichen für Zeichen dieselbe", async () => {
    // Die schärfste Zusicherung dieses Auftrags: der neue Schritt darf an einem sauberen Dokument
    // NICHTS tun. `toBe` und nicht `toContain` — ein zusätzliches Leerzeichen wäre schon zu viel.
    const SAUBER =
      "<h2>Nur Wissen</h2><p>Ein vollständiger Satz mit Punkt.</p><ul><li>Schritt eins</li></ul>";
    const { html, frameLines } = await extractDocxRich(new ArrayBuffer(4), {
      engine: engineFuer(SAUBER, "Nur Wissen\nEin vollständiger Satz mit Punkt.\nSchritt eins"),
    });
    expect(html).toBe(SAUBER);
    expect(frameLines).toEqual([]);
  });

  it("eine kurze Zeile ohne Wiederkehr bleibt stehen — im Zweifel wird nichts entfernt", async () => {
    // Die Wiederkehr im Dokument ist die einzige Evidenz, die eine Rahmenzeile von einer kurzen
    // echten Zeile unterscheidet. Fehlt sie, bleibt der Absatz — lieber eine Kopfzeile zu viel
    // als ein Satz Wissen zu wenig (D-042, wörtlich).
    const EINMALIG = "<p>Nur einmal da</p><h2>Titel</h2><p>Ein Satz.</p>";
    const { html, frameLines } = await extractDocxRich(new ArrayBuffer(4), {
      engine: engineFuer(EINMALIG, "Nur einmal da\nTitel\nEin Satz."),
    });
    expect(html).toBe(EINMALIG);
    expect(frameLines).toEqual([]);
  });
});

describe("JOB 1115 · A5 · am echten Produktpfad bis hinter den Server-Sanitizer", () => {
  it("der eingereichte Entwurf trägt die Kopfzeilen im Quellenvermerk, nicht im Wissen", async () => {
    const { html, text } = await extractDocxRich(new ArrayBuffer(4), { engine: wordEngine });
    const body = wholeDocumentBodyHtml({
      fileName: "design-guide.docx",
      text,
      html,
      sourceKind: "docx",
      locale: "de",
    });
    const persistiert = sanitizeHtml(body);

    // Der Quellenvermerk steht vorn und trägt die bewahrten Zeilen. Geprüft wird der BEREICH VOR
    // der ersten Überschrift — im ganzen Dokument zu suchen wäre auch ohne Bewahrung erfolgreich,
    // weil dieselben Zeilen weiter unten im Fließtext wiederkehren.
    const kopf = koerperVorErsterUeberschrift(persistiert);
    expect(kopf).toContain("Quelle: design-guide.docx, gesamtes Dokument");
    for (const zeile of [...RAHMEN, KOPFZEILE]) {
      expect(kopf, `„${zeile}" überlebt das Speichern nicht als Vermerk`).toContain(zeile);
    }

    // Und im WISSEN steht keine davon mehr als eigener Absatz vor der ersten Überschrift.
    for (const zeile of RAHMEN) {
      expect(kopf).not.toContain(`<p>${zeile}</p>`);
    }

    // Kein toter Link überlebt das Speichern — auch der Sanitizer lässt `#`-Ziele durch.
    expect(persistiert.match(/href="#_Toc/gi) ?? []).toEqual([]);
    expect(persistiert).toContain('href="https://example.org/norm"');
  });

  it("der Entwurfs-Nutzlast-Weg liefert dasselbe — keine zweite Wahrheit", async () => {
    const { html, text } = await extractDocxRich(new ArrayBuffer(4), { engine: wordEngine });
    const payload = wholeDocumentDraftPayload({
      fileName: "design-guide.docx",
      text,
      html,
      sourceKind: "docx",
      locale: "de",
    });
    expect(payload.bodyHtml ?? "").toContain(KOPFZEILE);
    expect(koerperVorErsterUeberschrift(payload.bodyHtml ?? "")).not.toContain("<p>en</p>");
  });
});
