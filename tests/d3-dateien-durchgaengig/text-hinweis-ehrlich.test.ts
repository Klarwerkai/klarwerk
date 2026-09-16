// ================================================================================================
// JOB 4203 · D3 / T1 — DER FEHLENDE VERLUSTHINWEIS DES TEXT-/MARKDOWN-IMPORTS.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT, steht im Produkt selbst geschrieben.
// `captureFromFile.ts:255-256` sagt den Zweck des Hinweises wörtlich: „ehrlicher, formatabhängiger
// Import-Hinweis — er wird Teil des persistierten Quelle-Blockquotes, damit der Entwurf NIE wie
// eine verlustfreie Übernahme aussieht."
//
// Umgesetzt war er für drei von vier Arten. `WholeSourceLabels` kannte `noteDocx`, `notePdf`,
// `notePptx` — und kein `noteText`; `wholeDocumentBodyHtml` setzte für jede andere Art `""`. Für
// Markdown galt damit das GEGENTEIL der eigenen Zusage: der Entwurf sah aus wie eine verlustfreie
// Übernahme, obwohl die Heuristik `renderTextBlock` nur Überschriften, Aufzählungen, Tabellen und
// Absätze kennt.
//
// DIE BAUFORM DER EHRLICHKEIT IST GELIEHEN, nicht neu erfunden: `tests/app/pptx-notes-honesty.
// test.ts:16` misst mit einer Negativ-Regex, dass eine Lesezeit-Meldung KEINEN Anhang behauptet.
// Zur Lesezeit ist nichts hochgeladen; ein Satz, der einen Anhang verspricht, wäre die teuerste
// Sorte Unwahrheit. Derselbe Maßstab gilt hier für den neuen Text-Satz.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT, wholeDocumentBodyHtml } from "../../apps/web/src/lib/captureFromFile";
import { MD_TITEL, markdownText } from "./referenzinhalt";

const SPRACHEN = ["de", "en", "nl"] as const;

/** Dieselbe Negativ-Regex wie `tests/app/pptx-notes-honesty.test.ts:16` — eine Quelle, ein Maßstab. */
const ANHANGS_BEHAUPTUNG = /liegt im Anhang|im Anhang|in the attachment|zit in de bijlage/i;

function ressource(sprache: string, schluessel: string): string {
  return String(i18n.getResource(sprache, "translation", schluessel));
}

/**
 * Der Quelle-Blockquote eines Ganzdokument-Rumpfes, zerlegt in seine zwei Aussagen: die HERKUNFT
 * (Dateiname, „gesamtes Dokument") und den VERLUSTHINWEIS. Gelesen wird der reale Rumpf, nicht eine
 * nachgebaute Zeichenkette.
 */
function quelleBlock(html: string): { herkunft: string; hinweis: string } {
  const block = /<blockquote>([\s\S]*?)<\/blockquote>/.exec(html)?.[1] ?? "";
  const absaetze = [...block.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1] ?? "");
  return { herkunft: absaetze[0] ?? "", hinweis: absaetze[1] ?? "" };
}

function rumpf(sprache: string): string {
  return wholeDocumentBodyHtml({
    fileName: "d3-referenz.md",
    text: markdownText(),
    sourceKind: "text",
    locale: sprache,
  });
}

describe("JOB 4203 · T1 — der Markdown-Entwurf sieht nicht wie eine verlustfreie Übernahme aus", () => {
  it("T1a · der Quelle-Blockquote trägt in DE/EN/NL einen nicht leeren Verlusthinweis", () => {
    for (const sprache of SPRACHEN) {
      const { herkunft, hinweis } = quelleBlock(rumpf(sprache));
      expect(herkunft, `${sprache}: keine Herkunft`).toContain("d3-referenz.md");
      expect(
        hinweis.length,
        `${sprache}: der Text-/Markdown-Import hat KEINEN Verlusthinweis — der Entwurf behauptet damit eine verlustfreie Übernahme`,
      ).toBeGreaterThan(0);
    }
  });

  it("T1b · jede Sprache hat ihren EIGENEN Satz — kein stiller deutscher Rückfall", () => {
    const saetze = SPRACHEN.map((s) => quelleBlock(rumpf(s)).hinweis);
    const eindeutig = new Set(saetze);
    expect(
      eindeutig.size,
      `nicht drei eigene Sätze, sondern ${eindeutig.size}: ${JSON.stringify(saetze)}`,
    ).toBe(SPRACHEN.length);
  });

  it("T1c · der Satz behauptet KEINEN Anhang — zur Lesezeit ist nichts hochgeladen", () => {
    for (const sprache of SPRACHEN) {
      const { hinweis } = quelleBlock(rumpf(sprache));
      expect(hinweis, sprache).not.toMatch(ANHANGS_BEHAUPTUNG);
    }
  });

  it("T1d · der Satz benennt, was die Heuristik NICHT übernimmt", () => {
    // DE wird auf den Inhalt festgenagelt: der Satz muss die Grenze wirklich aussprechen, nicht nur
    // irgendetwas sagen. `renderTextBlock` kennt Überschriften, Aufzählungen, Tabellen und Absätze —
    // Auszeichnungen (fett/kursiv), Verweise und Bilder bleiben als Zeichen stehen.
    const de = quelleBlock(rumpf("de")).hinweis;
    expect(de).toMatch(/Auszeichnungen/);
    expect(de).toMatch(/Verweise|Links/);
    expect(de).toMatch(/Bilder/);
  });

  it("T1h · RUNDE 3: der Satz nennt die LEERZEILEN-GRENZE — sie ist der gemessene Rest", () => {
    // Warum diese Zeile dazukommt: die Referenzdatei trägt seit Runde 3 eine Überschrift, die OHNE
    // Leerzeile unmittelbar auf eine Tabelle folgt. Sie wird — anders als die Tabelle — NICHT als
    // Überschrift übernommen, sondern bleibt Fließtext (`renderOhneTabelle`). Ohne diesen Halbsatz
    // sagte der Hinweis „Überschriften übernommen" auch für den Fall zu, in dem es nicht stimmt,
    // und wäre damit genau die Sorte Satz, gegen die dieser ganze Auftrag steht.
    for (const sprache of SPRACHEN) {
      const { hinweis } = quelleBlock(rumpf(sprache));
      expect(hinweis, `${sprache}: die Leerzeilen-Grenze wird nicht benannt`).toMatch(
        /Leerzeile|blank line|lege regel/,
      );
    }
    // Und die Grenze steht wirklich so im Rumpf: die Überschrift mit Strich ist KEINE Überschrift.
    const html = rumpf("de");
    expect(html, "die Überschrift ohne Leerzeile wurde doch zur Überschrift").not.toContain(
      "<h2>Abschnitt Drei | Grenzfaelle</h2>",
    );
    expect(html, "die Überschrift ohne Leerzeile ist verloren gegangen").toContain(
      "## Abschnitt Drei | Grenzfaelle",
    );
  });

  it("T1e · der Inhalt selbst steht im Rumpf — der Hinweis ersetzt ihn nicht", () => {
    const html = rumpf("de");
    expect(html).toContain(`<h2>${MD_TITEL}</h2>`);
  });

  it("T1f · die Lesezeit-Quittung der Oberfläche hat denselben Satz in DE/EN/NL", () => {
    // Der Blockquote steht im gespeicherten Entwurf; die Quittung steht unmittelbar nach dem
    // Einlesen auf der Fläche. Für DOCX/PDF/PPTX gibt es beides (`importNote.*`), für Text gab es
    // keines von beiden — ein Mensch las beim Markdown-Import gar keine Grenze.
    for (const sprache of SPRACHEN) {
      const satz = ressource(sprache, CAPTURE_FILE_TEXT.importNoteText);
      expect(satz.length, `${sprache}: importNote.text fehlt`).toBeGreaterThan(0);
      expect(satz, sprache).not.toMatch(ANHANGS_BEHAUPTUNG);
    }
    const alle = SPRACHEN.map((s) => ressource(s, CAPTURE_FILE_TEXT.importNoteText));
    expect(new Set(alle).size, `kein eigener Satz je Sprache: ${JSON.stringify(alle)}`).toBe(
      SPRACHEN.length,
    );
  });

  it("T1g · die Oberfläche wählt diese Quittung für den Text-Zweig wirklich aus", async () => {
    // Derselbe Griff wie `pptx-notes-honesty.test.ts:83-88`: ein Schlüssel, der nur in der
    // Übersetzungstabelle steht und nie gewählt wird, ist eine Scheinfunktion.
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    expect(src).toContain("CAPTURE_FILE_TEXT.importNoteText");
  });
});
