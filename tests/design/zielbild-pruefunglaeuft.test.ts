// ================================================================================================
// JOB 3056 · K1 — ABLOESUNGS-WAECHTER: DIE LADEKARTE „PruefungLaeuft“ (27.08.) IST ERSETZT.
// ================================================================================================
//
// Bis JOB 3056 stand hier die Chromium-Messung der Ladekarte (#ask-ladekarte mit drei Balken und
// dem Satz #ask-ladekarte-satz) gegen `DESIGN_ZIELBILD_20260827/PruefungLaeuft.dc.html`
// (JOB 3016 D3). Das Zustandsmodell des Auftrags JOB 3056 (§9) schafft die Karte ab: „Laden zeigt
// der Sendeknopf (Spinner im Kreis), sonst nichts" — KEIN Text wie „Klara sucht …" im Sichtfeld.
// Der Wartezustand wird jetzt in `tests/design/zielbild-k1-ruhe.test.ts` (F5: Kreisel verborgen,
// Pfeil sichtbar) und `tests/app/word-addin-ask.test.ts` (askWartezustand) gemessen.
//
// WAS DIESE DATEI JETZT TUT — und warum sie den alten Namen traegt: sie pinnt die Abloesung.
// Die Ladekarte und ihr Satz kommen nicht zurueck; der Schluessel askBusy lebt als zugaenglicher
// Name des Sendeknopfs weiter (aria-label, nie als sichtbarer Absatz), und der Kreisel steht im
// Knopf. Kein zweiter Messweg: kein Wert wird hier gegen ein Zielbild verglichen. Der Name bleibt,
// damit Verweise auf „die Messung der Ladekarte" (Werkzeug-Kommentare, alte Pin-Ketten) auf die
// Abloesung fuehren statt ins Leere.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = process.cwd();
const PANEL = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");
const NACHFOLGER = join(WURZEL, "tests", "design", "zielbild-k1-ruhe.test.ts");

/** Die Traeger der Ladekarte — sie kommen nicht zurueck. */
const ALTE_TRAEGER = [
  'id="ask-ladekarte"',
  'id="ask-ladekarte-satz"',
  'class="ladebalken"',
  'data-t="askBusy"',
];

function rumpf(html: string): string {
  const start = html.indexOf("<body>");
  const ende = html.indexOf("<script>", start);
  return html.slice(start, ende);
}

function befunde(html: string): string[] {
  const raus: string[] = [];
  const markup = rumpf(html);
  for (const t of ALTE_TRAEGER) {
    if (markup.includes(t)) raus.push(`Traeger der Ladekarte steht wieder im Rumpf: ${t}`);
  }
  return raus;
}

describe("JOB 3056 · Abloesung der Ladekarte PruefungLaeuft (27.08.) — Laden zeigt der Sendeknopf, sonst nichts", () => {
  const html = readFileSync(PANEL, "utf8");

  it("A · Ladekarte, Balken und der Satz darunter sind aus dem Rumpf GELOESCHT", () => {
    expect(befunde(html)).toEqual([]);
  });

  it("B · der Wartezustand ist der Kreisel im Sendeknopf; askBusy ist sein zugaenglicher Name (dreisprachig), kein sichtbarer Absatz", () => {
    expect(rumpf(html)).toContain('<svg class="kreisel"');
    expect(html).toContain('askLaeuft ? t("askBusy") : t("askCta")');
    expect(html).toContain('(askLaeuft ? " laeuft" : "")');
    expect(html.split('askBusy: "').length - 1).toBe(3);
  });

  it("C · der Nachfolger misst den Sendeknopf des Mockups (zielbild-k1-ruhe F4/F5)", () => {
    expect(existsSync(NACHFOLGER)).toBe(true);
    const nachfolger = readFileSync(NACHFOLGER, "utf8");
    expect(nachfolger).toContain("svg.kreisel");
    expect(nachfolger).toContain("MOCKUP_RUHE");
  });

  it("D · KALIBRIERUNG: eine zurueckkehrende Ladekarte schlaegt an", () => {
    const sonde = html.replace(
      '<div id="ask-status" class="status hidden"></div>',
      '<div id="ask-ladekarte" class="hidden"><div class="ladebalken"></div></div><p id="ask-ladekarte-satz" data-t="askBusy"></p><div id="ask-status" class="status hidden"></div>',
    );
    expect(sonde).not.toBe(html);
    expect(befunde(sonde).length).toBe(4);
  });
});
