import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { woerterbuchQuelleAus } from "../support/woerterbuchquelle";

// AUFTRAG-mega14 Block E (SCRUM-421) — die Grenzen stehen AN der Auswahlstelle, und sie kommen aus
// der Serverquelle.
//
// Der Live-Test ist daran durchgefallen: die Zahlen standen nur im Admin, und der Admin behauptete
// zugleich, sie würden beim Erfassen angezeigt. Tatsächlich war das an genau EINER von zwölf
// Auswahlstellen der Fall. Dieser Test schreibt beides fest — die Abdeckung und das Verbot fest
// verdrahteter Zahlen.

const WEB_SRC = join(__dirname, "../../apps/web/src");
const read = (p: string): string => readFileSync(join(WEB_SRC, p), "utf8");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Jede Datei, in der eine Datei gewählt, abgelegt oder eingefügt werden kann. Ermittelt, nicht
// geraten: das sind genau die Dateien mit einem `type="file"`-Feld bzw. einer Ablegefläche.
const AUSWAHLSTELLEN = [
  "pages/Capture.tsx",
  // JOB 3063 (H4): das Anhang-Feld des Wissensobjekts liegt jetzt im Abschnitt „Anhänge" hinter
  // der Zeile „Mehr" der Lesefläche — dieselbe Auswahlstelle, derselbe Grenzen-Hinweis.
  "components/bibliothek/MehrAbschnitte.tsx",
  "components/CaptureFileImport.tsx",
  "components/KnowledgeInputStudio.tsx",
  "components/BodyExtractPanel.tsx",
  "components/RichTextEditor.tsx",
  // Aufnahme 20260922 (mobile-erfassung, FR-CAP-04): `/mobile` hat jetzt die Fotoauswahl aus
  // Kamera und Mediathek — damit ist es eine Auswahlstelle wie jede andere (s. Fall „MOBIL" unten).
  "pages/Mobile.tsx",
];

describe("SCRUM-421: die Upload-Grenzen sind an jeder Auswahlstelle sichtbar", () => {
  it("die Liste der Auswahlstellen ist vollständig — keine Datei mit Dateifeld fehlt", () => {
    // Gegenprobe zur Liste oben: wer ein `type="file"` einführt, ohne hier aufzutauchen, fällt auf.
    const kandidaten = [
      ...AUSWAHLSTELLEN,
      // Bekannt und bewusst NICHT dabei: der JSON-Konfigurationsimport ist kein Anhang-Weg.
      // AUFTRAG-mega32 H2: er ist aus pages/Stufe2.tsx in ein eigenes Bauteil gezogen, damit die
      // gewählte Quelle ihn überhaupt erreichen kann. Die Gegenprobe zeigt weiterhin auf das
      // Dateifeld — nur an seinem neuen Ort.
      "components/ImportJsonUpload.tsx",
    ];
    for (const datei of kandidaten) {
      expect(read(datei), `${datei} hat kein Dateifeld mehr`).toContain('type="file"');
    }
  });

  it("jede Auswahlstelle zeigt den Grenzen-Hinweis", () => {
    for (const datei of AUSWAHLSTELLEN) {
      expect(stripComments(read(datei)), `${datei} zeigt die Grenzen nicht`).toContain(
        "<UploadLimitsHint",
      );
    }
  });

  it("die Vordertür erbt den Hinweis über den gemeinsamen Editor", () => {
    // Die Vordertür hat kein eigenes Dateifeld — ihre einzige Auswahlfläche ist der
    // RichTextEditor (Ablegen, Einfügen, Bild-/Datei-Menü). Der trägt den Hinweis, also die
    // Vordertür auch. Das ist die ehrliche Fassung von „auch in der Vordertür".
    //
    // JOB 3062 · H3: Der Editor steht nicht mehr in `pages/CaptureFrontDoor.tsx`. Die Seite ist nur
    // noch die Adresse und rendert das gemeinsame Blatt; der `RichTextEditor` sitzt seither IM
    // Blatt (`components/erfassen/Blatt.tsx`). Gemessen wird deshalb dort — dieselbe Aussage an
    // ihrem heutigen Ort, nicht eine schwächere.
    const frontdoor = stripComments(read("pages/CaptureFrontDoor.tsx"));
    const blatt = stripComments(read("components/erfassen/Blatt.tsx"));
    expect(frontdoor).not.toContain('type="file"');
    expect(blatt).toContain("<RichTextEditor");
    // Und die Vordertür führt wirklich auf dieses Blatt — sonst erbte sie nichts.
    expect(frontdoor).toContain("<Blatt");
    expect(stripComments(read("components/RichTextEditor.tsx"))).toContain("<UploadLimitsHint");
  });

  it("MOBIL: die Fotoauswahl trägt den Hinweis — eine Ablegefläche gibt es dort weiterhin nicht", () => {
    // BEFUND bis zur Aufnahme 20260922: `/mobile` besaß weder Dateifeld noch Ablegefläche noch
    // Kamera-Aufnahme, und dieser Fall sagte voraus: „Erscheint eine, wird dieser Test rot und der
    // Hinweis muss mit." Mit FR-CAP-04 ist sie erschienen (Kamera und Mediathek) — der Hinweis ist
    // mitgekommen, und die Fläche steht oben in `AUSWAHLSTELLEN`. Dieselbe Lage wie die Bildauswahl
    // des Editors: auch dort wird verkleinert in den Body eingebettet, und auch dort steht er.
    const mobile = stripComments(read("pages/Mobile.tsx"));
    expect(mobile).toContain('type="file"');
    expect(mobile).toContain("<UploadLimitsHint");
    expect(mobile).not.toContain("dataTransfer");
    // Die Kamera-Quelle wird am UNGEFILTERTEN Quelltext gemessen, und zwar als Attribut eines
    // `<input>`: `stripComments` liest `accept="image/*"` als Beginn eines Blockkommentars und
    // schluckt alles bis zum nächsten `*/` — das folgende `capture`-Attribut verschwände mit.
    // `[^>]*` hält die Suche innerhalb des einen Tags (vor `onChange={(e) => …}` steht kein `>`).
    expect(read("pages/Mobile.tsx")).toMatch(/<input[^>]*\bcapture="environment"/);
  });

  it("die Anzeige liest die Serverquelle — KEINE fest verdrahteten Zahlen", () => {
    const hint = read("components/UploadLimitsHint.tsx");
    expect(hint).toContain("useUploadLimits");
    // Weder die Werksvorgabe noch irgendeine andere Zahl darf hier stehen: sie würde beim nächsten
    // Admin-Wechsel zur nächsten Falschaussage.
    expect(stripComments(hint)).not.toMatch(/\b8\b/);
    expect(stripComments(hint)).not.toMatch(/20[_.]?000[_.]?000/);
  });

  it("der Hinweis behauptet nichts, solange die Werte nicht da sind", () => {
    // Ein Platzhalter mit Vorgabezahl wäre schlimmer als gar keine Anzeige.
    expect(read("components/UploadLimitsHint.tsx")).toContain("return null;");
  });

  it("der Hook fragt genau die Route ab, die der Server erzwingt", () => {
    expect(read("api/hooks.ts")).toContain("endpoints.uploadLimits.get");
    expect(read("api/endpoints.ts")).toContain("/upload-limits");
  });
});

describe("SCRUM-421: der Admin-Text behauptet nur noch, was stimmt", () => {
  const i18nSrc = woerterbuchQuelleAus(join(WEB_SRC, "i18n.ts"));

  it("die alte Behauptung (angezeigt beim Erfassen) ist weg", () => {
    // Sie war unwahr: die Zahl stand an einer einzigen von zwölf Auswahlstellen.
    expect(i18nSrc).not.toContain("werden beim Erfassen angezeigt");
    expect(i18nSrc).not.toContain("are shown during capture");
    expect(i18nSrc).not.toContain("bij het vastleggen getoond");
  });

  it("der neue Text nennt die Einheit ehrlich (Transportkodierung)", () => {
    // Gemessen wird die übertragene Daten-URL, rund das 1,37-Fache der Datei. Wer „20 MB" liest
    // und eine 20-MB-Datei anhängen will, soll nicht an einer unerklärten Grenze scheitern.
    expect(i18nSrc).toContain("Transportkodierung");
    expect(i18nSrc).toContain("transport encoding");
    expect(i18nSrc).toContain("transportcodering");
  });
});
