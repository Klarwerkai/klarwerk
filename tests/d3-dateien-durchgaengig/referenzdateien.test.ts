// ================================================================================================
// JOB 4203 · D3 / R — DIE DREI REFERENZDATEIEN SIND ECHT, UND SIE TRAGEN DEN BEKANNTEN INHALT.
// ================================================================================================
//
// WOGEGEN DIESE DATEI STEHT. Ein Bedienwegnachweis mit einer umbenannten Textdatei ist keiner: er
// liefe grün, ohne dass je ein PDF geparst oder ein Folienbaum gelesen worden wäre. Der Auftrag
// nennt genau diese Gegenprobe (§8.2: „Referenzdatei gegen eine umbenannte Textdatei tauschen →
// T3/T4 rot"). Hier steht sie als DAUERHAFTER Fall, damit sie nicht einmalig war: R4 legt eine
// umbenannte Textdatei neben die echten und zeigt, dass dieselben Prüfmittel daran anschlagen.
//
// WAS HIER NICHT GEPRÜFT WIRD, ausdrücklich: das PDF wird NICHT mit pdfjs geparst. Die einzige
// pdfjs-Engine des Hauses wird im Browser geladen (`files.ts:253-265`, lazy, mit Worker); ein
// zweiter Ladeweg in Node wäre ein zweiter Weg. Dass dieses PDF wirklich lesbar ist, belegt der
// Bedienwegnachweis `pdf-durchgaengig-chromium.test.ts` — im echten Bündel, mit der echten Engine.
// Hier wird belegt, dass die Datei die Bauform eines PDF hat und die bekannten Zeilen trägt.
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
// Echtes fflate — derselbe Bezugsweg wie in `tests/structure/pptx-rich-import.test.ts:7`.
import { Unzip, UnzipInflate, UnzipPassThrough } from "../../apps/web/node_modules/fflate";
import { budgetedPptxUnzip, extractPptxRich } from "../../apps/web/src/lib/pptx";
import {
  MD_ABSATZ_NACH_TABELLE,
  MD_ABSATZ_ZEILEN,
  MD_ABSCHNITT_EINS,
  MD_ABSCHNITT_ZWEI,
  MD_LISTENPUNKTE,
  MD_SUCHBEGRIFF,
  MD_TABELLE_KOPF,
  MD_TABELLE_ZEILEN,
  MD_TABELLE_ZEILE_MIT_SCHUTZ,
  MD_TITEL,
  MD_UEBERSCHRIFT_MIT_STRICH,
  PDF_SUCHBEGRIFF,
  PDF_ZEILEN,
  PPTX_FOLIENTITEL,
  PPTX_PUNKTE,
  PPTX_SPRECHERNOTIZ_MARKE,
  PPTX_SUCHBEGRIFF,
  markdownText,
  referenzBytes,
} from "./referenzinhalt";

const unzip = budgetedPptxUnzip({ Unzip, UnzipInflate, UnzipPassThrough });

/** Eine umbenannte Textdatei — das Gegenstück, an dem sich jedes Prüfmittel bewähren muss. */
const UMBENANNTE_TEXTDATEI = Buffer.from(
  `${MD_TITEL}\n${PPTX_FOLIENTITEL[0]}\n${PDF_SUCHBEGRIFF}\n`,
  "utf8",
);

function alsArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

describe("JOB 4203 · R — die Referenzdateien", () => {
  it("R1 · die Markdown-Referenz trägt Titel, zwei Abschnitte, eine Aufzählung UND eine Pipe-Tabelle", () => {
    const md = markdownText();
    expect(md.startsWith(`# ${MD_TITEL}`), "kein Titel als erste Zeile").toBe(true);
    expect(md).toContain(`## ${MD_ABSCHNITT_EINS}`);
    expect(md).toContain(`## ${MD_ABSCHNITT_ZWEI}`);
    for (const zeile of MD_ABSATZ_ZEILEN) {
      expect(md).toContain(zeile);
    }
    for (const punkt of MD_LISTENPUNKTE) {
      expect(md).toContain(`- ${punkt}`);
    }
    // Die Tabelle ist eine ECHTE GFM-Tabelle: Kopfzeile, Trennzeile, drei Datenzeilen.
    expect(md).toContain(`| ${MD_TABELLE_KOPF.join(" | ")} |`);
    expect(md).toMatch(/^\|\s*-{3,}\s*\|\s*-{3,}\s*\|$/m);
    for (const zeile of MD_TABELLE_ZEILEN.slice(0, 2)) {
      expect(md).toContain(`| ${zeile.join(" | ")} |`);
    }
    // RUNDE 2, Kante 1: die dritte Zeile trägt einen GESCHÜTZTEN Strich in der ersten Zelle.
    expect(md, "die Referenz trägt keine geschützte Pipe").toContain(MD_TABELLE_ZEILE_MIT_SCHUTZ);
    // RUNDE 3, Kante 3: unmittelbar unter der letzten Datenzeile steht eine ÜBERSCHRIFT mit
    // eigenem Strich, und erst darunter der Folgeabsatz — beide OHNE Leerzeile dazwischen.
    expect(md).toContain(
      `${MD_TABELLE_ZEILE_MIT_SCHUTZ}\n${MD_UEBERSCHRIFT_MIT_STRICH}\n${MD_ABSATZ_NACH_TABELLE}\n`,
    );
    // Der Suchbegriff kommt GENAU EINMAL vor — ein Treffer kann nichts anderes sein.
    expect(md.split(MD_SUCHBEGRIFF).length - 1).toBe(1);
  });

  it("R2 · die PDF-Referenz ist ein echtes PDF mit Querverweistabelle — und trägt alle sechs Zeilen", () => {
    const pdf = referenzBytes("pdf");
    const roh = pdf.toString("latin1");
    expect(roh.startsWith("%PDF-1."), "kein PDF-Kopf").toBe(true);
    expect(roh).toContain("/Type /Catalog");
    expect(roh).toContain("/Type /Page");
    expect(roh).toMatch(/\nxref\n0 \d+\n/);
    expect(roh).toMatch(/\ntrailer\n/);
    expect(roh).toMatch(/\nstartxref\n\d+\n%%EOF\n$/);
    for (const zeile of PDF_ZEILEN) {
      expect(roh, `Zeile fehlt im Inhaltsstrom: ${zeile}`).toContain(`(${zeile}) Tj`);
    }
    expect(roh.split(PDF_SUCHBEGRIFF).length - 1).toBe(1);
    // GEGENPROBE zum Prüfmittel: eine umbenannte Textdatei hat diese Bauform nicht.
    expect(UMBENANNTE_TEXTDATEI.toString("latin1").startsWith("%PDF-1.")).toBe(false);
  });

  it("R3 · die PPTX-Referenz liefert drei echte Folien mit Titel und Aufzählung", async () => {
    const res = await extractPptxRich(alsArrayBuffer(referenzBytes("pptx")), { unzip });
    expect(res.slideCount, "nicht drei Folien gelesen").toBe(3);
    for (const titel of PPTX_FOLIENTITEL) {
      expect(res.html, `Folientitel fehlt: ${titel}`).toContain(`<h2>${titel}</h2>`);
    }
    for (const folie of PPTX_PUNKTE) {
      for (const punkt of folie) {
        expect(res.html, `Aufzählungspunkt fehlt: ${punkt}`).toContain(`<li>${punkt}</li>`);
      }
    }
    expect(res.text).toContain(PPTX_SUCHBEGRIFF);
  });

  it("R3b · die EINE Sprechernotiz ist im Deck und kommt NICHT im übernommenen Inhalt an", async () => {
    // Zuerst: die Notiz liegt wirklich im Archiv — sonst prüfte der nächste Satz nichts.
    const roh = referenzBytes("pptx").toString("utf8");
    expect(roh, "die Referenz trägt gar keine Sprechernotiz").toContain(PPTX_SPRECHERNOTIZ_MARKE);
    expect(roh).toContain("ppt/notesSlides/notesSlide1.xml");

    const res = await extractPptxRich(alsArrayBuffer(referenzBytes("pptx")), { unzip });
    expect(res.text, "die Sprechernotiz ist in den Klartext gerutscht").not.toContain(
      PPTX_SPRECHERNOTIZ_MARKE,
    );
    expect(res.html, "die Sprechernotiz ist ins HTML gerutscht").not.toContain(
      PPTX_SPRECHERNOTIZ_MARKE,
    );
  });

  it("R4 · GEGENPROBE: eine umbenannte Textdatei besteht die PPTX-Prüfung nicht", async () => {
    let fehler: string | null = null;
    let folien = -1;
    try {
      const res = await extractPptxRich(alsArrayBuffer(UMBENANNTE_TEXTDATEI), { unzip });
      folien = res.slideCount;
    } catch (e) {
      fehler = String(e).split("\n")[0] ?? "";
    }
    // Entweder der Entpacker wehrt sich, oder er findet schlicht keine Folie. Beides ist das
    // Gegenteil von R3 — und genau das macht R3 zu einer Aussage.
    expect(fehler !== null || folien === 0, `Folien: ${folien}, Fehler: ${fehler}`).toBe(true);
  });
});
