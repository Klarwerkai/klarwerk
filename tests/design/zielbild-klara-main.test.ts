// ================================================================================================
// JOB 3056 · K1 — ABLOESUNGS-WAECHTER: DAS ZIELBILD „Main.dc.html“ VOM 27.08. IST ERSETZT.
// ================================================================================================
//
// Bis JOB 3056 stand hier die Chromium-Messung der Antwortkarte gegen das Zielbild
// `DESIGN_ZIELBILD_20260827/Main.dc.html` (JOB 3004 D1). Pedi hat dieses Zielbild am 04.09.2026
// durch das Mockup `design/klara/Main.dc.html` ERSETZT; die Messung dagegen ist
// `tests/design/zielbild-k1-antwort.test.ts` (Chromium, dist-Fassung, ein Vergleich je Wert).
//
// WAS DIESE DATEI JETZT TUT — und warum sie den alten Namen traegt: das alte Zielbild trug
// Erklaertext im Sichtfeld (Fusszeile „Woertlich zitiert · fachlich pruefen", „Neue Frage",
// Leitsatz, Herkunftszeile). Pedis Massstab (Pages, 1:100) verlangt, dass NICHTS davon
// zurueckkommt. Genau das wird hier gepinnt: die Traeger des alten Zielbilds existieren im Rumpf
// nicht mehr, ihre Woerterbuch-Schluessel sind gefallen, und der Nachfolger ist da. Kein zweiter
// Messweg — kein Wert des Mockups wird hier verglichen; das tut allein zielbild-k1-antwort.
// Der Name bleibt, damit jeder Verweis auf „die Messung gegen Main" (Werkzeug-Kommentare, alte
// Pin-Ketten) auf die Ablösung fuehrt statt ins Leere.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = process.cwd();
const PANEL = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");
const NACHFOLGER = join(WURZEL, "tests", "design", "zielbild-k1-antwort.test.ts");
const ALTES_ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/Main.dc.html";

/** Die Traeger des alten Zielbilds, die im Sichtfeld standen — und nicht zurueckkommen. */
const ALTE_TRAEGER = [
  'id="antwortkarte-fuss"',
  'id="antwortkarte-fuss-hinweis"',
  'id="ask-neue-frage-btn"',
  'id="klara-leitsatz"',
  'data-t="askFussHinweis"',
  'data-t="klaraLeitsatz"',
];
/** Ihre Woerterbuch-Schluessel — in allen drei Sprachen gefallen, kein toter Schluessel. */
const ALTE_SCHLUESSEL = ["askFussHinweis:", "klaraLeitsatz:"];

function rumpf(html: string): string {
  const start = html.indexOf("<body>");
  const ende = html.indexOf("<script>", start);
  return html.slice(start, ende);
}

function befunde(html: string): string[] {
  const raus: string[] = [];
  const markup = rumpf(html);
  for (const t of ALTE_TRAEGER) {
    if (markup.includes(t)) raus.push(`Traeger des alten Zielbilds steht wieder im Rumpf: ${t}`);
  }
  for (const k of ALTE_SCHLUESSEL) {
    const n = html.split(k).length - 1;
    if (n > 0) raus.push(`Schluessel ${k} steht noch ${n}x im Woerterbuch`);
  }
  return raus;
}

describe("JOB 3056 · Abloesung des Zielbilds Main.dc.html (27.08.) — nichts davon kommt ins Sichtfeld zurueck", () => {
  const html = readFileSync(PANEL, "utf8");

  it("A · die Traeger des alten Zielbilds sind aus dem Rumpf GELOESCHT, ihre Schluessel gefallen", () => {
    expect(befunde(html)).toEqual([]);
    // Und die Auskunft, die sie trugen, lebt hinter dem Zahnrad weiter (kein Verlust, ein Umzug).
    expect(html).toContain('data-t="askReviewNotice"');
    expect(html).toContain('id="ask-rule-note"');
  });

  it("B · der Nachfolger misst das Mockup vom 04.09. — zielbild-k1-antwort gegen design/klara/Main.dc.html", () => {
    expect(existsSync(NACHFOLGER)).toBe(true);
    const nachfolger = readFileSync(NACHFOLGER, "utf8");
    expect(nachfolger).toContain("MOCKUP_ANTWORT");
    expect(nachfolger).toContain("frageStellen");
  });

  it("C · KALIBRIERUNG: ein zurueckkehrender Traeger schlaegt an", () => {
    const sonde = html.replace(
      '<div id="antwortkarte-aktionen">',
      '<div id="antwortkarte-fuss"><p id="antwortkarte-fuss-hinweis"></p></div><div id="antwortkarte-aktionen">',
    );
    expect(sonde).not.toBe(html);
    expect(befunde(sonde).length).toBe(2);
  });

  it.runIf(existsSync(ALTES_ZIELBILD))(
    "D · das alte Zielbild trug den Erklaertext wirklich — die Abloesung misst einen echten Unterschied",
    () => {
      const alt = readFileSync(ALTES_ZIELBILD, "utf8");
      expect(alt).toContain("Wörtlich zitiert · fachlich prüfen");
      expect(alt).toContain(">Neue Frage<");
      expect(rumpf(html)).not.toContain("Wörtlich zitiert · fachlich prüfen");
    },
  );
});
