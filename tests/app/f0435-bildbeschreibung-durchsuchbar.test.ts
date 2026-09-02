// ==================================================================================================
// F-0435 · JOB 2961 · D1 — FORMATIERTE BILDBESCHREIBUNGEN BLEIBEN DURCHSUCHBAR
// ==================================================================================================
//
// WAS DAS REGISTER VERSPRICHT (F-0435, woertlich): „Alle Leser der Bildbeschreibung ersetzten jedes
// Formatierungszeichen durch ein Leerzeichen, sodass aus ‚Ventil V2,' ein ‚Ventil V2 ,' wurde und
// eine Suche ueber die Wortgrenze formatierte Beschreibungen nicht mehr fand. Die Umwandlung in
// Klartext laeuft jetzt an einer gemeinsamen Stelle."
//
// WAS DAVON STEHT: die gemeinsame Stelle gibt es (`services/structure/src/captions.ts`), und die
// INLINE-Haelfte ist gebaut (mega84 Block B, dort Z. 108-117): `<br>` wird ein Leerzeichen,
// Auszeichnung verschwindet spurlos. „<em>Ventil V2</em>," liest sich wieder als „Ventil V2,".
//
// DIE GEMESSENE LUECKE, und sie ist die Umkehrung desselben Fehlers: An der BLOCKGRENZE wird
// KEIN Leerzeichen gesetzt. Gemessen am Produktstand `6d574fce`, mit dem echten Sanitizer davor:
//
//     <figcaption><p>Ventil V2</p><p>gerissen</p></figcaption>   →   "Ventil V2gerissen"
//     <figcaption><div>…</div><div>…</div></figcaption>          →   "Ventil V2gerissen"
//     <figcaption><ul><li>…</li><li>…</li></ul></figcaption>     →   "Ventil V2gerissen"
//
// Zwei Woerter werden zu einem. Wer „Ventil V2" sucht, findet die Fussnote nicht mehr — und wer
// „gerissen" sucht, auch nicht. Das ist derselbe Schaden, den F-0435 beheben soll; mega84 hat das
// Zuviel an der Inline-Grenze beseitigt und das Zuwenig an der Blockgrenze stehen lassen.
//
// DASS BLOCKELEMENTE DORT UEBERHAUPT ANKOMMEN, ist gemessen und nicht vermutet: `ALLOWED_TAGS` in
// `services/structure/src/sanitize.ts` (Z. 5-35) kennt p, div, h2, h3, ul, ol, li, blockquote und
// die Tabellen-Tags, und der Sanitizer prueft KEINE Verschachtelung — eine figcaption mit
// `<p>`-Absaetzen (Einfuegen aus Word in die editierbare Fussnote) passiert ihn unveraendert. Die
// Sonde dieses Durchgangs hat genau das gezeigt.
//
// DER BELEG, DASS DAS PROJEKT ES SELBST ANDERS WEISS: `sanitize.ts:708` behandelt fuer den
// Body-Klartext GENAU diese Tags als Wortgrenze (`</(p|h2|h3|li|blockquote|div|caption|figcaption|
// th|td|tr)>` → Leerzeichen). Zwei Leser derselben Wahrheit gaben bisher zwei verschiedene
// Antworten; dieser Durchgang gleicht die Fussnote an die laengst geltende Regel an.
import { describe, expect, it } from "vitest";
import { captionsMatchQuery } from "../../services/library-analytics/src/search-captions";
import { imageCaptionTexts, searchCaptionTexts } from "../../services/structure/src/captions";
import { sanitizeHtml } from "../../services/structure/src/sanitize";

/** Eine Figur, wie der Editor sie baut — die Fussnote traegt den uebergebenen Inhalt. */
const figur = (caption: string): string =>
  `<figure><img src="/api/objects/x/raw" data-image-id="kw-a"><figcaption data-image-id="kw-a">${caption}</figcaption></figure>`;

/** Derselbe Weg, den ein echtes Wissensobjekt geht: erst durch den Sanitizer, dann in den Scanner. */
const gespeichert = (caption: string): string => sanitizeHtml(figur(caption));

describe("F-0435 · die Blockgrenze in der Bildbeschreibung ist eine Wortgrenze", () => {
  it("Absaetze in der Fussnote verschmelzen die Woerter NICHT", () => {
    expect(imageCaptionTexts(gespeichert("<p>Ventil V2</p><p>gerissen</p>"))).toEqual([
      "Ventil V2 gerissen",
    ]);
  });

  it("dasselbe fuer div, Listenpunkte, Ueberschrift und Tabellenzelle", () => {
    const faelle: [string, string][] = [
      ["<div>Ventil V2</div><div>gerissen</div>", "Ventil V2 gerissen"],
      ["<ul><li>Ventil V2</li><li>gerissen</li></ul>", "Ventil V2 gerissen"],
      ["<h2>Ventil V2</h2>gerissen", "Ventil V2 gerissen"],
      ["<blockquote>Ventil V2</blockquote>gerissen", "Ventil V2 gerissen"],
      ["<table><tr><td>Ventil V2</td><td>gerissen</td></tr></table>", "Ventil V2 gerissen"],
    ];
    for (const [inhalt, erwartet] of faelle) {
      expect(imageCaptionTexts(gespeichert(inhalt)), inhalt).toEqual([erwartet]);
    }
  });

  it("ein Block am Rand erzeugt keinen Rand-Leerraum und kein doppeltes Leerzeichen", () => {
    // Ausnahme (2) des Suchvertrags aus mega85/mega86 bleibt gewahrt: der Absatzwechsel ist GENAU
    // EIN Leerzeichen. Zwei waeren wieder ein Reduktionsartefakt.
    expect(imageCaptionTexts(gespeichert("<p>Ventil V2</p>"))).toEqual(["Ventil V2"]);
    expect(imageCaptionTexts(gespeichert("<p>A</p><p>B</p>"))).toEqual(["A B"]);
    expect(imageCaptionTexts(gespeichert("<div><p>A</p></div><p>B</p>"))).toEqual(["A B"]);
  });
});

describe("F-0435 · die Inline-Haelfte aus mega84 bleibt unangetastet", () => {
  it("Auszeichnung verschwindet weiterhin SPURLOS — das Artefakt 'V2 ,' kehrt nicht zurueck", () => {
    // Genau dieses Artefakt zu beseitigen war der Zweck von mega84/mega85. Ein Fix an der
    // Blockgrenze, der die Inline-Grenze wieder aufreisst, waere ein Rueckschritt.
    expect(imageCaptionTexts(gespeichert("Der <em>Ventil V2</em>, gerissen."))).toEqual([
      "Der Ventil V2, gerissen.",
    ]);
    expect(imageCaptionTexts(gespeichert("<strong>fett und <em>kursiv</em></strong>!"))).toEqual([
      "fett und kursiv!",
    ]);
    expect(
      imageCaptionTexts(gespeichert('Der <u>Dichtring</u>: <a href="/x">Ventil</a>.')),
    ).toEqual(["Der Dichtring: Ventil."]);
  });

  it("der Zeilenumbruch bleibt ein Leerzeichen, und die formatierte Fussnote liest sich wie die schlichte", () => {
    expect(imageCaptionTexts(gespeichert("Erste Zeile<br>zweite Zeile"))).toEqual([
      "Erste Zeile zweite Zeile",
    ]);
    expect(imageCaptionTexts(gespeichert("<p>Der <em>Dichtring</em> am Ventil V2</p>"))).toEqual(
      imageCaptionTexts(gespeichert("Der Dichtring am Ventil V2")),
    );
  });

  it("leere Fussnoten und Alt-Platzhalter fallen weiterhin weg", () => {
    expect(imageCaptionTexts(gespeichert("<p></p>"))).toEqual([]);
    expect(imageCaptionTexts(gespeichert("<p>Noch keine Bildbeschreibung</p>"))).toEqual([]);
  });
});

describe("F-0435 · was der Nutzer davon hat: die Fussnote wird wieder gefunden", () => {
  it("die Suche ueber die Blockgrenze trifft — vorher fand sie nichts", () => {
    const body = gespeichert("<p>Ventil V2</p><p>gerissen</p>");
    // `captionsMatchQuery` ist der Suchvertrag der Bibliothek (case-insensitiver Substring).
    expect(captionsMatchQuery(body, "ventil v2")).toBe(true);
    expect(captionsMatchQuery(body, "gerissen")).toBe(true);
    // Und die Verschmelzung selbst ist weg.
    expect(captionsMatchQuery(body, "v2gerissen")).toBe(false);
  });

  it("das persistierte Suchfeld traegt denselben Text — Deckel unveraendert", () => {
    // `searchCaptionTexts` ist die Stelle, die das abgeleitete Suchfeld schreibt. Sie liegt UEBER
    // dem Scanner; der Groessendeckel bleibt unberuehrt.
    expect(searchCaptionTexts(gespeichert("<p>Ventil V2</p><p>gerissen</p>"))).toEqual([
      "Ventil V2 gerissen",
    ]);
    const lang = `<p>${"A".repeat(400)}</p><p>${"B".repeat(400)}</p>`;
    const [text] = searchCaptionTexts(gespeichert(lang));
    expect(text).toHaveLength(500);
  });
});

describe("F-0435 · Gegenprobe: dieser Test kann zubeissen", () => {
  it("die alte Reduktion faellt hier durch", () => {
    // Die exakte Reduktion des Ausgangsstands, hier nachgebaut. Sie steht als Zeuge im Test: waere
    // die Produktaenderung zurueckgenommen, lieferte der Scanner wieder DIESES Ergebnis — und die
    // Faelle oben waeren rot. Der Test prueft also einen Unterschied, den es wirklich gibt.
    const alteReduktion = (inner: string): string =>
      inner
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
    expect(alteReduktion("<p>Ventil V2</p><p>gerissen</p>")).toBe("Ventil V2gerissen");
    expect(imageCaptionTexts(gespeichert("<p>Ventil V2</p><p>gerissen</p>"))).not.toEqual([
      alteReduktion("<p>Ventil V2</p><p>gerissen</p>"),
    ]);
    // Umgekehrt: an der Inline-Grenze MUSS das Ergebnis weiterhin dasselbe sein wie zuvor.
    expect(imageCaptionTexts(gespeichert("Der <em>Ventil V2</em>, gerissen."))).toEqual([
      alteReduktion("Der <em>Ventil V2</em>, gerissen."),
    ]);
  });
});
