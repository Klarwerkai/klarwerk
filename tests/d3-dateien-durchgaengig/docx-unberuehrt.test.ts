// ================================================================================================
// JOB 4203 · D3 / T7 — DER ABGENOMMENE DOCX-WEG BLEIBT, WIE ER IST.
// ================================================================================================
//
// DIE PRÜFLÜCKE, DIE DIESER FALL SCHLIESST (Auftrag §8.6 i): dieser Auftrag arbeitet am GEMEINSAMEN
// `wholeDocumentBodyHtml` — an derselben Funktion, über die der bereits abgenommene DOCX-Weg läuft
// (`gespraech/gesamt-abnahme-20260914/docx-erfolgreich/`). Ein Umbau dort kann den DOCX-Weg
// beschädigen, ohne dass einer der drei neuen Bedienwegnachweise etwas davon merkt.
//
// WARUM HIER KEIN FÜNFTER BROWSERFALL STEHT, und das ist eine Entscheidung mit Grund: geändert
// wurden zwei Stellen — der `sourceKind`-Zweig im Quelle-Blockquote und die Block-Heuristik
// `renderTextBlock`. BEIDE sind DOM-frei und liegen VOR jeder Oberfläche. Ein Browserlauf misst an
// dieser Stelle dasselbe wie diese Datei, kostet aber einen weiteren Chromium im Tor (Auftrag §8.6
// iii nennt die Tor-Last ausdrücklich als Risiko). Der Bedienweg des DOCX-Imports bleibt daneben
// durch `gespraech/…/docx-erfolgreich` und die unveränderten Bestandstests gedeckt.
//
// GEMESSEN WIRD AM ECHTEN `sample.docx` — nicht an einem getippten Text, der so tut, als käme er aus
// Word. Der Weg ist derselbe wie im Produkt: `extractDocxRich` liefert Klartext UND Struktur-HTML,
// und genau dieses Paar geht in `wholeDocumentBodyHtml`.
import type { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  wholeDocumentBodyHtml,
  wholeDocumentDraftPayload,
} from "../../apps/web/src/lib/captureFromFile";
import { type DocxRichResult, extractDocxRich } from "../../apps/web/src/lib/docx";

const DOCX = "sample.docx";

/** Frische Kopie → echtes `ArrayBuffer` (Muster aus `tests/capture/docx-extract.test.ts:26-30`). */
function alsArrayBuffer(buf: Buffer): ArrayBuffer {
  const kopie = new Uint8Array(buf.byteLength);
  kopie.set(buf);
  return kopie.buffer;
}

async function wordDokument(): Promise<DocxRichResult> {
  const bytes = readFileSync(resolve(process.cwd(), "tests/fixtures", DOCX));
  return extractDocxRich(alsArrayBuffer(bytes));
}

/** Der Rumpf ohne den Quelle-Blockquote — also das, was aus dem Dokument selbst stammt. */
function ohneQuelle(html: string): string {
  return html.replace(/^<blockquote>[\s\S]*?<\/blockquote>/, "");
}

describe("JOB 4203 · T7 — der DOCX-Weg am gemeinsamen Rumpfbauer", () => {
  it("T7a · Herkunft und DOCX-Verlusthinweis stehen unverändert im Quelle-Blockquote (DE/EN/NL)", async () => {
    // Der deutsche Wortlaut ist der ABGENOMMENE: genau dieser Satz steht im Beleg der
    // Gesamtprüfung (`docx-erfolgreich/test-results/…/33-entwurf-mit-quelle.txt:35`).
    const erwartet: Readonly<Record<string, string>> = {
      de: "Struktur und Bilder übernommen (Best-Effort) — exaktes Layout kann abweichen.",
      en: "Structure and images imported (best effort) — exact layout may differ.",
      nl: "Structuur en afbeeldingen overgenomen (best effort) — de exacte layout kan afwijken.",
    };
    const docx = await wordDokument();
    for (const [sprache, satz] of Object.entries(erwartet)) {
      const html = wholeDocumentBodyHtml({
        fileName: DOCX,
        text: docx.text,
        html: docx.html,
        sourceKind: "docx",
        locale: sprache,
      });
      expect(html, sprache).toContain(`<p>${satz}</p>`);
      expect(html, sprache).toMatch(/^<blockquote><p>(?:Quelle|Source|Bron): sample\.docx, /);
    }
  });

  it("T7b · das Struktur-HTML aus Word gewinnt — die Text-Heuristik fasst es nicht an", async () => {
    const docx = await wordDokument();
    expect(docx.text.length, "aus der DOCX kam kein Klartext").toBeGreaterThan(0);
    const mitStruktur = ohneQuelle(
      wholeDocumentBodyHtml({
        fileName: DOCX,
        text: docx.text,
        html: docx.html,
        sourceKind: "docx",
        locale: "de",
      }),
    );
    // Die Zusage: liegt `html` an, wird es ÜBERNOMMEN — der Blockheuristik-Zweig (und damit auch
    // die neue Tabellenerkennung) läuft dann gar nicht erst.
    expect(mitStruktur).toBe(docx.html.trim());

    // ============================================================================================
    // DIE GEGENPROBE, und warum sie NICHT über den Klartext derselben Datei laufen kann.
    // ============================================================================================
    // Der erste Anlauf verglich `html`-Weg und Text-Weg mit DEMSELBEN Klartext. Er war rot, und zu
    // Recht: `sample.docx` besteht aus einem Satz, beide Wege ergeben `<p>Ventil bei Überdruck
    // schließen.</p>` — der Vergleich konnte über den Vorrang gar nichts sagen (gemessen,
    // Arbeitsprüfung e1274f3d3c1b4a71ae17bb9784b8de3c).
    //
    // Gemessen wird deshalb der VORRANG selbst: neben das echte Struktur-HTML wird ein Klartext
    // gelegt, der im Ergebnis auf keinen Fall auftauchen darf. Steht er trotzdem da, hat die
    // Heuristik das Word-HTML verdrängt.
    const FREMDER_KLARTEXT = "DIESER-TEXT-DARF-NICHT-IN-DEN-RUMPF-4203";
    const mitFremdtext = ohneQuelle(
      wholeDocumentBodyHtml({
        fileName: DOCX,
        text: FREMDER_KLARTEXT,
        html: docx.html,
        sourceKind: "docx",
        locale: "de",
      }),
    );
    expect(mitFremdtext, "die Text-Heuristik hat das Word-HTML verdrängt").not.toContain(
      FREMDER_KLARTEXT,
    );
    expect(mitFremdtext).toBe(docx.html.trim());
    // Und die Gegenrichtung: OHNE `html` wird genau dieser Klartext verarbeitet. Erst damit ist
    // belegt, dass der Unterschied am Vorrang hängt und nicht daran, dass der Text ignoriert würde.
    expect(
      ohneQuelle(
        wholeDocumentBodyHtml({
          fileName: DOCX,
          text: FREMDER_KLARTEXT,
          sourceKind: "docx",
          locale: "de",
        }),
      ),
    ).toBe(`<p>${FREMDER_KLARTEXT}</p>`);
  });

  it("T7c · der DOCX-Entwurf trägt weiterhin Titel, Aussage und Herkunft", async () => {
    const docx = await wordDokument();
    const payload = wholeDocumentDraftPayload({
      fileName: DOCX,
      text: docx.text,
      html: docx.html,
      sourceKind: "docx",
      locale: "de",
    });
    expect((payload.title ?? "").length).toBeGreaterThan(0);
    expect((payload.statement ?? "").length).toBeGreaterThan(0);
    expect(payload.bodyHtml ?? "").toContain(`Quelle: ${DOCX}, gesamtes Dokument`);
    expect(payload.origin).toBe("frontdoor");
  });
});
