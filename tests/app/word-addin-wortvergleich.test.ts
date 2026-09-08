// ================================================================================================
// JOB 3281 · WORD-VERGLEICH — DER VERTRAGSBLOCK AN DER AUSGELIEFERTEN DATEI.
// ================================================================================================
//
// Was `tests/word-vergleich/*` AUSFUEHREND misst (Farben, Listen, Ruecknahme), sichert diese Datei
// STATISCH an den ausgelieferten Bytes von `apps/web/public/word-addin/taskpane.html`: die Zusagen,
// die ein einzelner Ablauf nicht zeigen kann, weil sie ueber ALLE Ablaeufe gelten.
//
//   V1  Der Block existiert und ist ein geschlossenes Marken-Paar (KW-WORDVERGLEICH-START/END).
//   V2  Im Vergleichsweg steht KEIN Schreibzugriff auf das Dokument (§5.2: „Kein Text wird
//       veraendert, nichts wird eingefuegt"). Ein einzelner Testlauf beweist nur, dass DIESER
//       Lauf nichts geschrieben hat; hier steht, dass es die Stelle gar nicht gibt.
//   V3  Der Block oeffnet KEIN zweites Abrufziel: kein `fetch(` darin. Der Weg zur Route ist
//       `w6DublettenAusCheckText` — derselbe Uebersetzer, den die Erfassen- und die Bestandsflaeche
//       benutzen (mega69-klara-merkmale M7 zaehlt die Ziele, dieser Fall zaehlt die Stellen).
//   V4  Die vier Farben sind Word-Namen, keine Farbliterale — sonst waere die Palette der
//       Werkbank (mega43 B1) an einer Stelle umgangen, die gar keine Flaeche ist.
//   V5  Das Woerterbuch traegt DE, EN und NL mit derselben Schluesselmenge (die Vorfuehrung am
//       11.09. laeuft auf Englisch; Deutsch bleibt gleichwertig).
//   V6  Kein Schluessel des Blocks traegt die Woerter, die die Wortliste der Word-Flaeche
//       ausserhalb des Einstufungshinweises verbietet (mega35 B) — hier als eigener, frueher
//       Anschlag, damit der Verstoss am Block auffaellt und nicht erst im Tor.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const TASKPANE = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");

function quelle(): string {
  return readFileSync(TASKPANE, "utf8");
}

/** Der Inhalt zwischen den beiden Marken — ohne sie ist jede Aussage darunter wertlos. */
function block(): string {
  const src = quelle();
  const von = src.indexOf("// KW-WORDVERGLEICH-START");
  const bis = src.indexOf("// KW-WORDVERGLEICH-END");
  expect(von, "KW-WORDVERGLEICH-START fehlt in taskpane.html").toBeGreaterThan(0);
  expect(bis, "KW-WORDVERGLEICH-END fehlt in taskpane.html").toBeGreaterThan(von);
  return src.slice(von, bis);
}

/** Nur die Zeilen, die etwas TUN — Kommentare duerfen einen Namen nennen, ohne ihn zu benutzen. */
function ausfuehrbar(text: string): string {
  return text
    .split("\n")
    .filter((zeile) => !/^\s*\/\//.test(zeile))
    .join("\n");
}

/** Die drei Sprachtabellen des Blocks als Schluessel-Wert-Paare, zeilenweise erhoben. */
function texte(): Map<string, Map<string, string>> {
  const roh = block();
  const raus = new Map<string, Map<string, string>>();
  let sprache: string | null = null;
  for (const zeile of roh.split("\n")) {
    const kopf = /^\s{6}(de|en|nl):\s*\{\s*$/.exec(zeile);
    if (kopf?.[1]) {
      sprache = kopf[1];
      raus.set(sprache, new Map());
      continue;
    }
    const paar = /^\s{8}([A-Za-z0-9]+):\s*"(.*)",\s*$/.exec(zeile);
    if (paar?.[1] !== undefined && paar[2] !== undefined && sprache !== null) {
      (raus.get(sprache) as Map<string, string>).set(paar[1], paar[2]);
    }
  }
  return raus;
}

describe("JOB 3281 · V · der Vergleichsblock im ausgelieferten Aufgabenfenster", () => {
  it("V1 · der Block steht als geschlossenes Marken-Paar in der Datei", () => {
    const inhalt = block();
    // Kalibrierung: ein leerer Block liesse jede Zusage darunter still durchgehen.
    expect(inhalt.length).toBeGreaterThan(2000);
    expect(inhalt).toContain("function wvPruefen");
    expect(inhalt).toContain("function wvEntfernen");
  });

  it("V2 · im Vergleichsweg gibt es keinen Schreibzugriff auf das Dokument", () => {
    const code = ausfuehrbar(block());
    for (const verboten of [
      "insertText",
      "insertHtml",
      "insertParagraph",
      "insertOoxml",
      "insertInlinePictureFromBase64",
      "setSelectedDataAsync",
    ]) {
      expect(code.includes(verboten), `${verboten} steht im Vergleichsweg`).toBe(false);
    }
    // GEGENPROBE ZUM SUCHER: das Fenster als Ganzes fuehrt Schreibwege — der Sucher greift also.
    expect(ausfuehrbar(quelle())).toContain("insertText");
  });

  it("V3 · der Block oeffnet kein zweites Abrufziel", () => {
    expect(/\bfetch\(/.test(ausfuehrbar(block()))).toBe(false);
    // …und benutzt wirklich den EINEN Uebersetzer zur Route.
    expect(ausfuehrbar(block())).toContain("w6DublettenAusCheckText(");
  });

  it("V4 · die vier Farben sind Word-Namen, kein Farbliteral", () => {
    const code = ausfuehrbar(block());
    expect(code).toContain('exakt: "BrightGreen"');
    expect(code).toContain('sinngleich: "Yellow"');
    expect(code).toContain('neu: "Turquoise"');
    expect(code).toContain('widerspruch: "Red"');
    // Kein `#rrggbb`, kein `rgb(` — die Werkbank-Palette (mega43) bleibt die eine Farbwahrheit.
    expect(/#[0-9a-fA-F]{3,8}\b/.test(code), "Farbliteral im Vergleichsblock").toBe(false);
    expect(/\brgba?\(/.test(code), "rgb()-Literal im Vergleichsblock").toBe(false);
  });

  it("V5 · DE, EN und NL tragen dieselbe Schluesselmenge", () => {
    const tabellen = texte();
    expect([...tabellen.keys()].sort()).toEqual(["de", "en", "nl"]);
    const de = tabellen.get("de") as Map<string, string>;
    // Kalibrierung: eine leere Ernte waere ein gruener Waechter ohne Gegenstand.
    expect(de.size).toBeGreaterThanOrEqual(25);
    for (const sprache of ["en", "nl"]) {
      const tabelle = tabellen.get(sprache) as Map<string, string>;
      const fehlend = [...de.keys()].filter((k) => !tabelle.has(k));
      const zuviel = [...tabelle.keys()].filter((k) => !de.has(k));
      expect(fehlend, `${sprache}: fehlende Schluessel`).toEqual([]);
      expect(zuviel, `${sprache}: ueberzaehlige Schluessel`).toEqual([]);
      for (const [schluessel, wert] of tabelle) {
        expect(wert.trim().length, `${sprache}.${schluessel} ist leer`).toBeGreaterThan(0);
      }
    }
    // Die Platzhalter je Schluessel bleiben erhalten — sonst braeche die Einsetzung in EN/NL.
    const marken = (wert: string): string[] => (wert.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    for (const sprache of ["en", "nl"]) {
      const tabelle = tabellen.get(sprache) as Map<string, string>;
      for (const [schluessel, wert] of de) {
        expect(marken(tabelle.get(schluessel) ?? ""), `${sprache}.${schluessel}`).toEqual(
          marken(wert),
        );
      }
    }
  });

  it("V6 · kein Schluessel traegt die Woerter, die die Wortliste der Word-Flaeche verbietet", () => {
    const verboten: Array<{ sprache: string; muster: RegExp }> = [
      { sprache: "de", muster: /gepr(ue|ü)ft/i },
      { sprache: "de", muster: /gesichert/i },
      { sprache: "en", muster: /verified/i },
      { sprache: "en", muster: /assured/i },
      { sprache: "nl", muster: /gecontroleerd/i },
      { sprache: "nl", muster: /gewaarborgd/i },
    ];
    const verstoesse: string[] = [];
    for (const [sprache, tabelle] of texte()) {
      for (const { sprache: s, muster } of verboten) {
        if (s !== sprache) {
          continue;
        }
        for (const [schluessel, wert] of tabelle) {
          if (muster.test(wert)) {
            verstoesse.push(`${sprache}.${schluessel}: ${wert}`);
          }
        }
      }
    }
    expect(verstoesse).toEqual([]);
  });
});
