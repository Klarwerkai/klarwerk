// ================================================================================================
// AUFTRAG-mega74 TEIL 2 — DIE BILDER WIRKLICH ÜBERGEBEN, UND 2b: SAGEN, WAS MAN NICHT DURFTE.
// ================================================================================================
//
// TEIL 2: Bis mega74 hat Klara den Bildverlust nur GEZÄHLT und ehrlich gemeldet. Jetzt werden die
// Bytes über `Body.inlinePictures` → `InlinePicture.getBase64ImageSrc()` geholt.
//
// DIE ANFORDERUNGSSTUFE, an der Dokumentation belegt (learn.microsoft.com, Stand 17.06.2026):
// alle drei Bausteine sind **WordApi 1.1** — Body.inlinePictures, InlinePictureCollection
// (Klasse/items/load) und getBase64ImageSrc(). Das Manifest bleibt bei MinVersion 1.1; für Pedi
// gibt es hier NICHTS zu entscheiden. Gemieden werden `getFirst()` (WordApi 1.3) und `imageFormat`
// (WordApiDesktop 1.1) — deshalb kommt der Bildtyp aus den Bytes.
//
// EHRLICHE GRENZE, gemessen und benannt: in der WordApi-**1.1**-Ansicht von `Word.Range` gibt es
// KEIN `inlinePictures` (die 1.1-Eigenschaften sind contentControls, font, paragraphs,
// parentContentControl, style, text). Der AUSWAHL-Umfang geht deshalb über
// `getSelection().paragraphs` und wird zur LAUFZEIT versucht statt geglaubt — schlägt er fehl,
// bleibt exakt die heutige ehrliche Meldung stehen.
//
// WAS DIESER TEST NICHT KANN: die Office-Aufrufe selbst. `Word.run`, `inlinePictures` und
// `getBase64ImageSrc` liegen ausserhalb des gespiegelten Marker-Blocks und haben keinen Host im
// Testlauf — sie sind hier nur als Quelltext gepinnt. Belegt wird die ENTSCHEIDUNGSLOGIK: welcher
// Typ akzeptiert wird, wie zugeordnet wird, und wann bewusst NICHTS eingesetzt wird.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fillWordImages, wordImageMimeFromBase64 } from "../../apps/web/src/lib/wordAddin";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

// Echte Base64-Präfixe der vier Rastertypen, die der Server-Sanitizer inline akzeptiert.
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPEG =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const GIF = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const WEBP = "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

describe("mega74 Teil 2 · der Bildtyp kommt aus den BYTES, nicht aus einer Typangabe", () => {
  it("erkennt genau die vier Typen, die der Server-Sanitizer inline akzeptiert", () => {
    expect(wordImageMimeFromBase64(PNG)).toBe("image/png");
    expect(wordImageMimeFromBase64(JPEG)).toBe("image/jpeg");
    expect(wordImageMimeFromBase64(GIF)).toBe("image/gif");
    expect(wordImageMimeFromBase64(WEBP)).toBe("image/webp");
  });

  it("KALIBRIERUNG — Unbekanntes wird NICHT geraten, sondern abgelehnt", () => {
    // Ohne diesen Fall würde die Prüfung oben auch dann grün, wenn die Funktion alles akzeptiert.
    expect(wordImageMimeFromBase64("")).toBeNull();
    expect(wordImageMimeFromBase64("PD94bWwgdmVyc2lvbj0=")).toBeNull(); // SVG/XML — bewusst NICHT
    expect(wordImageMimeFromBase64("Zm9vYmFy")).toBeNull(); // „foobar"
    // Ein RIFF-Container, der KEIN WEBP ist (z. B. WAV), fällt ebenfalls durch.
    expect(wordImageMimeFromBase64("UklGRiQAAABXQVZFZm10IA==")).toBeNull();
  });

  it("führende data:-Präfixe und Leerraum stören die Erkennung nicht", () => {
    expect(wordImageMimeFromBase64(`data:image/png;base64,${PNG}`)).toBe("image/png");
    expect(wordImageMimeFromBase64(`  ${PNG}  `)).toBe("image/png");
  });
});

describe("mega74 Teil 2 · die Zuordnung ist streng — lieber eine Lücke als ein falsches Bild", () => {
  it("setzt ein fehlendes Bild wirklich ein und meldet die Bilanz ehrlich", () => {
    const html = '<p><img src="cid:image001.png@01DB" alt="Typenschild"></p>';
    const out = fillWordImages(html, [PNG]);
    expect(out.filled).toBe(1);
    expect(out.remaining).toBe(0);
    expect(out.hindernis).toBeNull();
    expect(out.html).toContain(`src="data:image/png;base64,${PNG}"`);
    expect(out.html).not.toContain("cid:");
    // Das übrige Tag bleibt unangetastet — der Alt-Text ist Inhalt.
    expect(out.html).toContain('alt="Typenschild"');
  });

  it("DIE ZUORDNUNG LÄUFT ÜBER DEN INDEX — ein bereits geliefertes Bild verschiebt nichts", () => {
    // Word liefert je nach Fassung EINEN Teil der Bilder schon als data:-URL. Eine fortlaufende
    // Zählung „das nächste fehlende" wäre hier um genau dieses Bild verschoben — und das zweite
    // Bild bekäme die Bytes des ersten. Genau das darf nicht passieren.
    const html = `<p><img src="data:image/gif;base64,${GIF}"></p><p><img src="cid:zweites"></p>`;
    const out = fillWordImages(html, [GIF, PNG]);
    expect(out.filled).toBe(1);
    expect(out.remaining).toBe(0);
    // Das erste Bild behält SEIN gif, das zweite bekommt das PNG — nicht umgekehrt.
    expect(out.html).toContain(`data:image/gif;base64,${GIF}`);
    expect(out.html).toContain(`data:image/png;base64,${PNG}`);
  });

  it("passen die ANZAHLEN nicht, wird NICHTS eingesetzt — und das wird benannt", () => {
    const html = '<p><img src="cid:a"></p><p><img src="cid:b"></p>';
    const out = fillWordImages(html, [PNG]); // zwei Tags, ein Bild
    expect(out.filled).toBe(0);
    expect(out.remaining).toBe(2);
    expect(out.hindernis).toBe("anzahl-passt-nicht");
    expect(out.html).toBe(html); // unverändert
  });

  it("ein Bild mit unbekanntem Typ bleibt EHRLICH fehlend statt still eingesetzt", () => {
    const html = '<p><img src="cid:a"></p><p><img src="cid:b"></p>';
    const out = fillWordImages(html, [PNG, "PD94bWwgdmVyc2lvbj0="]);
    expect(out.filled).toBe(1);
    expect(out.remaining, "das zweite Bild fehlt weiterhin und wird gemeldet").toBe(1);
    expect(out.html).not.toContain("PD94bWwg");
  });

  it("ohne Bilder im HTML passiert nichts (kein Hindernis, keine erfundene Zahl)", () => {
    const out = fillWordImages("<p>nur Text</p>", []);
    expect(out.filled).toBe(0);
    expect(out.remaining).toBe(0);
    expect(out.hindernis).toBeNull();
  });
});

describe("mega74 Teil 2 · der Inline-Spiegel im buildlosen Taskpane ist verhaltensgleich", () => {
  it("Marker-Block ausführen und die beiden neuen Helfer gegen das Modul vergleichen", () => {
    const start = HTML.indexOf("// KW-WORDADDIN-HELPERS-START");
    const end = HTML.indexOf("// KW-WORDADDIN-HELPERS-END");
    expect(start).toBeGreaterThan(0);
    const block = HTML.slice(start, end);
    const factory = new Function(
      `${block}; return { wordImageMimeFromBase64: wordImageMimeFromBase64, fillWordImages: fillWordImages };`,
    );
    const inline = factory() as {
      wordImageMimeFromBase64: (b: string) => string | null;
      fillWordImages: (h: string, l: readonly string[]) => Record<string, unknown>;
    };

    for (const probe of [PNG, JPEG, GIF, WEBP, "", "Zm9vYmFy", `data:image/png;base64,${PNG}`]) {
      expect(inline.wordImageMimeFromBase64(probe), `mime:${probe.slice(0, 12)}`).toBe(
        wordImageMimeFromBase64(probe),
      );
    }
    const faelle: [string, string[]][] = [
      ['<p><img src="cid:a"></p>', [PNG]],
      ['<p><img src="cid:a"></p><p><img src="cid:b"></p>', [PNG]],
      [`<p><img src="data:image/gif;base64,${GIF}"></p><p><img src="cid:b"></p>`, [GIF, PNG]],
      ["<p>nur Text</p>", []],
    ];
    for (const [html, liste] of faelle) {
      expect(inline.fillWordImages(html, liste), `fill:${html.slice(0, 24)}`).toEqual(
        fillWordImages(html, liste),
      );
    }
  });
});

describe("mega74 Teil 2 · was am Quelltext gepinnt ist", () => {
  it("der Bildweg benutzt genau die WordApi-1.1-Bausteine — und keinen höheren", () => {
    const code = HTML.replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain("inlinePictures");
    expect(code).toContain("getBase64ImageSrc");
    // getFirst() wäre WordApi 1.3 — der Weg geht bewusst über load("items") + Index.
    expect(code, "getFirst() ist WordApi 1.3 und darf hier nicht auftauchen").not.toContain(
      "getFirstOrNullObject",
    );
    expect(code).not.toContain("inlinePictures.getFirst");
    // imageFormat wäre WordApiDesktop 1.1.
    expect(code).not.toContain("imageFormat");
  });

  it("das Manifest bleibt bei WordApi MinVersion 1.1 — der Bildweg zwingt uns NICHT höher", () => {
    const manifest = readFileSync(
      resolve(process.cwd(), "docs/word-addin/klara-manifest.xml"),
      "utf8",
    );
    expect(manifest).toContain('<Sets DefaultMinVersion="1.1">');
    expect(manifest).toContain('<Set Name="WordApi" MinVersion="1.1" />');
  });

  it("die benannte Obergrenze existiert und ist eine Zahl, keine Zusage", () => {
    expect(HTML).toContain("WORD_ADDIN_MAX_BILDER = 60");
  });

  it("die ehrliche Meldung bleibt bestehen — sie wird NICHT durch den Bildweg ersetzt", () => {
    // Der wichtigste Pin dieses Teils: „kein stiller Erfolg". Werden nicht alle Bilder geholt,
    // sagt Klara es weiterhin mit Zahl.
    expect(HTML).toContain("sendImagesMissing");
    expect(HTML).toContain("prepared.undeliveredImages");
    expect(HTML.split('sendImagesMissing: "').length - 1, "dreisprachig").toBe(3);
  });
});

describe("mega74 Teil 2b · Klara sagt, was sie nicht durfte — und was wirklich gefragt wird", () => {
  it("die Texte zur Frage-Herkunft stehen in allen drei Sprachen", () => {
    // AUFTRAG-mega77 BLOCK A: `askGapUnchecked` stand hier als vierter Schlüssel. Er ist mit dem
    // Ungeprüft-Zähler ENTFERNT — die Zahl entstand ohne Betrachterfilter (Leck ab n = 1) und
    // zählte die gedeckelte Vorauswahl statt des Bestands. Dass er weg ist, prüft
    // tests/app/mega77-klara-wortlaut-und-frist.test.ts; die drei Herkunfts-Texte bleiben.
    for (const key of [
      'askSourceSelection: "',
      'askSourceSelectionOverride: "',
      'askSourceManual: "',
    ]) {
      expect(HTML.split(key).length - 1, key).toBe(3);
    }
  });

  it("die Herkunfts-Zeile benutzt DIESELBE Entscheidung wie der Absendeweg", () => {
    // Nicht eine zweite Auslegung, die morgen anders ausfällt — genau die Lehre aus A22.
    const fn = HTML.slice(HTML.indexOf("function updateAskSourceNote()"));
    expect(fn.slice(0, 900)).toContain("prepareAskQuestion(selectionText");
  });

  it("sie wird aktuell gehalten: beim Tippen, beim Betreten des Feldes und bei Auswahländerung", () => {
    expect(HTML).toContain('addEventListener("input", updateAskSourceNote)');
    expect(HTML).toContain('addEventListener("focus", updateAskSourceNote)');
    expect(HTML).toContain("Office.EventType.DocumentSelectionChanged");
  });
});
