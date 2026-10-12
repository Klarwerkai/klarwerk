// ================================================================================================
// AUFNAHME 20260922 · ZENTRALE-MODULE-AUFTEILEN (R-1611, P11) — DER ECHTE SCHNITT IST VERLUSTFREI.
// ================================================================================================
//
// `apps/web/public/word-addin/taskpane.html` war bis zu diesem Auftrag EINE Datei. Jetzt sind es
// drei (`taskpane.html`, `taskpane.css`, `taskpane.js`). Rund hundert Prüfstände lesen das Fenster
// seither über `tests/support/panelquelle.ts` als EIN Dokument — und ihre Aussagen gelten nur, wenn
// dieses Dokument WIRKLICH das ist, was vorher in der einen Datei stand.
//
// Genau das misst diese Datei, und zwar gegen einen Wert, den der Test nicht selbst erzeugt: die
// Git-Blob-Kennung der ungeschnittenen Datei. Das war der Basisstand `3b79c5d1`; seit der
// Integration mit `main` ist es die Datei von `main` a2ff8da8 (R-0169 hat dort das Inline-Skript
// weitergebaut, die Änderung steht jetzt in `taskpane.js`). Nachprüfbar ohne diesen Test mit
// `git rev-parse a2ff8da8:apps/web/public/word-addin/taskpane.html`. Seit der Aufnahme
// m365-anmeldung steht zusätzlich deren Anmeldeänderung in `taskpane.js`; der Bezugswert ist
// dadurch `3c755f63…` — Herleitung und Abgrenzung am Wert in `tests/support/panelquelle.ts`.
//
// Das Verhalten (vorher gegen nachher, je ein eigenes jsdom-Fenster) misst `probeschnitt.test.ts`.
import { describe, expect, it } from "vitest";
import {
  PANEL_CSS_VERWEIS,
  PANEL_JS_VERWEIS,
  PANEL_MARKE_VERWEIS,
  PANEL_VOR_SCHNITT_BLOB,
  PANEL_WV_VERWEIS,
  fuegePanelZusammen,
  gitBlobKennung,
  markeAbschnitt,
  panelQuelle,
  panelQuelleAus,
  panelTeile,
  wortvergleichAbschnitt,
} from "../support/panelquelle";
import { bytes, tabelle, zeilen } from "./zerlegung";

describe("R-1611 · E — das zusammengefügte Fenster ist die Datei des Basisstands", () => {
  it("E1 · Kalibrierung: `gitBlobKennung` rechnet wie `git hash-object`", () => {
    // Zwei bekannte Werte — ohne sie wäre E2 ein Vergleich zweier selbstgebauter Zahlen.
    expect(gitBlobKennung("")).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
    expect(gitBlobKennung("hello\n")).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
  });

  it("E2 · Byte für Byte: die drei Dateien ergeben genau die frühere `taskpane.html`", () => {
    expect(gitBlobKennung(panelQuelle())).toBe(PANEL_VOR_SCHNITT_BLOB);
  });

  it("E3 · Gegenprobe: ein einziges Zeichen in einer der drei Dateien macht E2 rot", () => {
    const teile = panelTeile();
    const varianten = [
      { ...teile, css: `${teile.css} ` },
      { ...teile, js: teile.js.replace("use strict", "use strikt") },
      { ...teile, html: teile.html.replace("<title>", "<title> ") },
    ];
    for (const v of varianten) {
      expect(gitBlobKennung(fuegePanelZusammen(v))).not.toBe(PANEL_VOR_SCHNITT_BLOB);
    }
  });

  it("E4 · das Zusammenfügen ist fail-closed: fehlt ein Verweis oder steht er doppelt, bricht es", () => {
    const teile = panelTeile();
    expect(() =>
      fuegePanelZusammen({ ...teile, html: teile.html.replace(PANEL_JS_VERWEIS, "") }),
    ).toThrow(/genau einmal/);
    expect(() =>
      fuegePanelZusammen({ ...teile, html: `${teile.html}${PANEL_CSS_VERWEIS}` }),
    ).toThrow(/genau einmal/);
    // Und ein Pfad, der nicht auf das Fenster zeigt, wird nicht still umgebogen.
    expect(() => panelQuelleAus("apps/web/public/word-addin/anmeldung.html")).toThrow(/ist nicht/);
  });

  it("E5 · die Ablage, gedruckt: wie sich das Fenster jetzt auf die drei Dateien verteilt", () => {
    const teile = panelTeile();
    const ganz = panelQuelle();
    const zeile = (name: string, text: string): string[] => [
      name,
      String(zeilen(text) - 1),
      String(bytes(text)),
    ];
    console.log(
      `\nR-1611 · das Aufgabenfenster nach dem Schnitt:\n${tabelle(
        ["Datei", "Zeilen", "Bytes"],
        [
          zeile("taskpane.html (Markup)", teile.html),
          zeile("taskpane.css (Stil)", teile.css),
          zeile("taskpane.js (Skript)", teile.js),
          zeile("marke.js (KW-MARKE)", teile.marke),
          zeile("wortvergleich.js (KW-WORDVERGLEICH)", teile.wortvergleich),
          zeile("vorher: eine Datei", ganz),
        ],
      )}\n`,
    );
    // Die Markup-Datei ist das, was zwei Bahnen jetzt gleichzeitig anfassen können, ohne sich am
    // Skript zu begegnen — sie muss klein bleiben, sonst ist der Schnitt nur verschoben.
    expect(zeilen(teile.html)).toBeLessThan(500);
    // Die Bilanz geht auf das Byte auf: dazugekommen sind die zwei Verweise, weggefallen die vier
    // Tags samt Zeilenumbruch nach dem Öffnen und Einrückung vor dem Schließen — sonst nichts.
    const tags = bytes("<style>\n  </style><script>\n  </script>");
    const verweise = bytes(PANEL_CSS_VERWEIS) + bytes(PANEL_JS_VERWEIS);
    // Zerlegungsauftrag Bestandsblick: dazu die vierte Datei. Sie bringt ihren Verweis samt
    // Zeilenumbruch und Einrueckung in die Seite und ihren Kopf in sich selbst mit — sonst nichts.
    const markeVerweis = bytes(`\n  ${PANEL_MARKE_VERWEIS}`);
    const markeKopf = bytes(teile.marke) - bytes(markeAbschnitt(teile.marke));
    expect(markeKopf).toBeGreaterThan(0);
    // R-0336/R-0708: dazu die fünfte Datei. Ihr Verweis steht in der Zeile von `taskpane.js` (kein
    // Zeilenumbruch, keine Einrückung), ihren Kopf bringt sie in sich selbst mit — sonst nichts.
    const wvVerweis = bytes(PANEL_WV_VERWEIS);
    const wvKopf = bytes(teile.wortvergleich) - bytes(wortvergleichAbschnitt(teile.wortvergleich));
    expect(wvKopf).toBeGreaterThan(0);
    const dateien =
      bytes(teile.html) +
      bytes(teile.css) +
      bytes(teile.js) +
      bytes(teile.marke) +
      bytes(teile.wortvergleich);
    expect(dateien).toBe(
      bytes(ganz) - tags + verweise + markeVerweis + markeKopf + wvVerweis + wvKopf,
    );
  });
});
