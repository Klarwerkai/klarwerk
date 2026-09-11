// ================================================================================================
// JOB 3474 · REVIEW26 — DER RUNDLAUF: `bodyFileLink.ts` LIEST JETZT AUCH SEINE EIGENE FORM.
// ================================================================================================
//
// Bis zu diesem Auftrag konnte das Modul, das die Body-Datei-Referenz SCHREIBT (`fileLinkHtml`),
// sie nicht LESEN. Deshalb konnte der Kopf der Lesefläche eine Originaldatei im Text nicht kennen
// (`BibliothekLesen.tsx:534-536` zählt nur `ko.attachments` und `ko.sources`).
//
// WARUM HIER UND NICHT IN EINEM NEUEN SCANNER (Lieferung 2, Wiederverwendungsprüfung):
//   · `extractBodyImages` (`apps/web/src/lib/bodyImages.ts:152`) ist der vorhandene bodyHtml-Leser.
//     Er sucht `figure`/`img`/`figcaption` über einen Tiefenzähler und liefert `BodyImage`
//     (`id`, `src`, `caption`) — er kennt `div.attachment > a` nicht und könnte es ohne Umbau eines
//     FREMDEN Zielpfads auch nicht. Wiederverwendbar wäre allein sein privater Attributleser.
//   · Deshalb steht die Leseseite dort, wo die Schreibseite steht: im selben Modul, gegen dieselbe
//     `objectRawHref`-Strenge. Der Rundlauf unten bindet beide Seiten aneinander — ändert jemand
//     die Schreibform, wird DIESER Test rot und nicht erst die Oberfläche.
//   · `captionTexts` (`api/types.ts:342`) ist ein SERVER-Feld über Bildunterschriften; es enthält
//     keine Datei-Referenzen und ist deshalb kein Kandidat.
//   · WIEDERVERWENDET WIRD DAGEGEN DIE REDUKTION: der Name kommt aus `htmlToPlainText`
//     (`lib/richText.ts:450`), der kanonischen Klartext-Regel dieses Hauses — nicht aus einer
//     zweiten, selbstgebauten Entity-Rückübersetzung. Das erste Gate dieses Auftrags hat gezeigt,
//     warum: mega85 (`tests/capture/mega85-suchtext-formatierung.test.ts`) erhebt JEDE Rohreduktion
//     als Befund, weil genau dort der mega84-Fehler entstand („Ventil V2 ," statt „Ventil V2,").
//     R11 unten fährt diese Zusage, statt sie zu behaupten.
import { describe, expect, it } from "vitest";
import { bodyFileLinksFromHtml, fileLinkHtml } from "../../apps/web/src/lib/bodyFileLink";

const ID = "5d4f2b6a-1c3e-4f8a-9b2d-77e1c0a4b915";

describe("JOB 3474 · bodyFileLinksFromHtml — die Gegenrichtung zu fileLinkHtml", () => {
  it("R1 · RUNDLAUF: was `fileLinkHtml` schreibt, liest die Lesefunktion zurück", () => {
    const html = fileLinkHtml({ objectId: ID, name: "Vertrag-2024.docx" });
    expect(bodyFileLinksFromHtml(html)).toEqual([{ objectId: ID, name: "Vertrag-2024.docx" }]);
  });

  it("R2 · der Link steht hinter dem Text — Reihenfolge und Anzahl stimmen", () => {
    const ersteDatei = fileLinkHtml({ objectId: "obj-1", name: "A.docx" });
    const zweiteDatei = fileLinkHtml({ objectId: "obj-2", name: "B.pdf" });
    const html = `<h2>Kapitel</h2><p>Text</p>${ersteDatei}${zweiteDatei}`;
    expect(bodyFileLinksFromHtml(html)).toEqual([
      { objectId: "obj-1", name: "A.docx" },
      { objectId: "obj-2", name: "B.pdf" },
    ]);
  });

  it("R3 · escapte Namen kommen als Klartext zurück (dieselbe Zeichenkette, die geschrieben wurde)", () => {
    const name = 'Plan <A&B> "final".docx';
    const html = fileLinkHtml({ objectId: "obj-3", name });
    expect(html).toContain("&lt;A&amp;B&gt;");
    expect(bodyFileLinksFromHtml(html)).toEqual([{ objectId: "obj-3", name }]);
  });

  it("R4 · eine FREMDE Adresse ergibt NICHTS (kein Fake-Treffer)", () => {
    expect(
      bodyFileLinksFromHtml(
        '<div class="attachment"><a href="https://fremd.example/x">X</a></div>',
      ),
    ).toEqual([]);
    expect(
      bodyFileLinksFromHtml('<div class="attachment"><a href="/api/objects/x/other">X</a></div>'),
    ).toEqual([]);
  });

  it("R5 · ein Pfad-Trick ergibt NICHTS — dieselbe Strenge wie `objectRawHref`", () => {
    expect(
      bodyFileLinksFromHtml('<div class="attachment"><a href="/api/objects/../raw">X</a></div>'),
    ).toEqual([]);
    expect(
      bodyFileLinksFromHtml('<div class="attachment"><a href="/api/objects/a/b/raw">X</a></div>'),
    ).toEqual([]);
  });

  it("R6 · ohne die Klasse `attachment` ist es keine Datei-Referenz", () => {
    expect(
      bodyFileLinksFromHtml(`<p><a href="/api/objects/${ID}/raw">Vertrag.docx</a></p>`),
    ).toEqual([]);
    expect(
      bodyFileLinksFromHtml(`<div class="panel"><a href="/api/objects/${ID}/raw">V.docx</a></div>`),
    ).toEqual([]);
  });

  it("R7 · Bilder im Body sind keine Datei-Referenzen (Auftrag §8.6 d)", () => {
    const bild =
      '<figure><img data-image-id="b1" src="/api/objects/bild-1/raw" alt="V">' +
      '<figcaption data-image-id="b1">Ventil</figcaption></figure>';
    expect(bodyFileLinksFromHtml(bild)).toEqual([]);
  });

  it("R8 · leer, null und undefined ergeben eine leere Liste statt eines Fehlers", () => {
    expect(bodyFileLinksFromHtml("")).toEqual([]);
    expect(bodyFileLinksFromHtml(null)).toEqual([]);
    expect(bodyFileLinksFromHtml(undefined)).toEqual([]);
  });

  it("R9 · Attributreihenfolge und Anführungszeichen sind egal — der Sanitizer darf umschreiben", () => {
    expect(
      bodyFileLinksFromHtml(
        `<div class='attachment'><a title='Bericht.docx' href='/api/objects/${ID}/raw'>Bericht.docx</a></div>`,
      ),
    ).toEqual([{ objectId: ID, name: "Bericht.docx" }]);
  });

  it("R10 · ohne sichtbaren Namen trägt der `title` den Namen; ohne beides „Datei“", () => {
    expect(
      bodyFileLinksFromHtml(
        `<div class="attachment"><a href="/api/objects/${ID}/raw" title="Anlage.pdf"></a></div>`,
      ),
    ).toEqual([{ objectId: ID, name: "Anlage.pdf" }]);
    expect(
      bodyFileLinksFromHtml(`<div class="attachment"><a href="/api/objects/${ID}/raw"></a></div>`),
    ).toEqual([{ objectId: ID, name: "Datei" }]);
  });

  // ================================================================================================
  // RUNDE 2 · BENS GEGENPROBE — TEXT IN EINEM ATTRIBUT IST KEINE ADRESSE.
  // ================================================================================================
  //
  // Runde 1 las den Attributwert mit einem SUCHENDEN Ausdruck („finde `href=` irgendwo im Tag").
  // Ein `href=/api/objects/fake/raw` im `title` wurde damit zur Adresse — der Kopf behauptete
  // „Originaldatei · Fremd.docx", obwohl der Link nach `https://fremd.example/x` zeigt. Der Fall
  // überlebt `sanitizeHtml`, weil `title` am `<a>` ein erlaubtes Attribut mit freiem Text ist.
  // Die gemountete Hälfte dieser Absicherung steht in `kopf-schweigt-ohne-datei.test.tsx` (F-N5).
  it("R12 · BENS FALL: ein `href=` im `title` ersetzt die echte Adresse NICHT", () => {
    const html =
      '<div class="attachment">\n' +
      '  <a title="Hinweis href=/api/objects/fake/raw "\n' +
      '     href="https://fremd.example/x">Fremd.docx</a>\n' +
      "</div>";
    expect(bodyFileLinksFromHtml(html)).toEqual([]);
  });

  // Die ZWEITE Hälfte desselben Fehlers, und sie ist nicht theoretisch: der alte Leser prüfte die
  // Klasse mit demselben suchenden Ausdruck. Ein „ class=attachment" im `title` machte deshalb aus
  // einem `div.panel` einen Anhangblock — der Leerraum vor dem Namen ist alles, was der alte Leser
  // verlangte, und in einem Freitext steht er ständig.
  it("R13 · ein ` class=attachment` im `title` macht aus einem `div.panel` keinen Anhang", () => {
    expect(
      bodyFileLinksFromHtml(
        `<div title="Block class=attachment" class="panel"><a href="/api/objects/${ID}/raw">X.docx</a></div>`,
      ),
    ).toEqual([]);
    // Und ein `href=` im sichtbaren TEXT ist erst recht keine Adresse.
    expect(
      bodyFileLinksFromHtml(
        '<div class="attachment"><a href="https://fremd.example/x"> href=/api/objects/fake/raw</a></div>',
      ),
    ).toEqual([]);
  });

  it("R14 · die Reihenfolge der Attribute rettet den Angriff nicht (title vor UND nach href)", () => {
    const vorher = `<div class="attachment"><a title='Hinweis href=/api/objects/fake/raw' href='https://fremd.example/x'>F.docx</a></div>`;
    const nachher = `<div class="attachment"><a href='https://fremd.example/x' title='Hinweis href=/api/objects/fake/raw'>F.docx</a></div>`;
    expect(bodyFileLinksFromHtml(vorher)).toEqual([]);
    expect(bodyFileLinksFromHtml(nachher)).toEqual([]);
  });

  it("R15 · FAIL-CLOSED: eine unlesbare Attributliste ergibt NICHTS, nie eine geratene Datei", () => {
    // Unbalanciertes Anführungszeichen: der Rest des Tags ist kein Attribut mehr.
    expect(
      bodyFileLinksFromHtml(
        `<div class="attachment"><a title="offen href="/api/objects/${ID}/raw">X.docx</a></div>`,
      ),
    ).toEqual([]);
    // Kalibrierung: derselbe Block OHNE das offene Anführungszeichen wird sehr wohl gelesen —
    // sonst prüfte dieser Fall nur, dass die Funktion überhaupt etwas verwirft.
    expect(
      bodyFileLinksFromHtml(
        `<div class="attachment"><a title="offen" href="/api/objects/${ID}/raw">X.docx</a></div>`,
      ),
    ).toEqual([{ objectId: ID, name: "X.docx" }]);
  });

  it("R11 · mega85: eine ausgezeichnete Beschriftung liest sich WIE die unausgezeichnete", () => {
    // Der Fehler, gegen den mega85 steht: eine Reduktion, die je Tag ein Leerzeichen einsetzt,
    // macht aus „Ventil V2, final.docx" ein „Ventil V2 , final.docx". Hier wird nichts eigenes
    // reduziert — `htmlToPlainText` trägt es —, und dieser Fall fährt das, statt es zu glauben.
    const mit = `<div class="attachment"><a href="/api/objects/${ID}/raw"><strong>Ventil V2</strong>, final.docx</a></div>`;
    const ohne = `<div class="attachment"><a href="/api/objects/${ID}/raw">Ventil V2, final.docx</a></div>`;
    expect(bodyFileLinksFromHtml(mit)).toEqual(bodyFileLinksFromHtml(ohne));
    expect(bodyFileLinksFromHtml(mit)[0]?.name).toBe("Ventil V2, final.docx");
  });
});
