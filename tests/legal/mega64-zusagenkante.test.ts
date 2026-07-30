// ================================================================================================
// AUFTRAG-mega64 BLOCK C — ZWEI TEXTE ÜBER DASSELBE VERHALTEN LAUFEN NICHT AUSEINANDER.
// ================================================================================================
//
// Der Befund, den ben in sammel61 gemeldet hat (Finding 2, letzter Absatz), war kein Codefehler:
//
//     Die Datenschutzerklärung nannte die Tab-Grenze der Abmeldesperre EHRLICH. Die sichtbare
//     Sperrmeldung sagte dagegen UNQUALIFIZIERT, die Anwendung zeige bis zur Klärung keine Inhalte.
//     Zwei Texte im selben Produkt, die verschieden viel versprachen — und der weitergehende stand
//     dort, wo die Nutzerin ihn liest.
//
// Block B hat die Grenze beseitigt, statt den Text zu beschneiden. Damit stimmen beide Stellen heute.
// Das Problem an „stimmt heute" ist, dass es aus Arbeitsteilung entsteht: Wer die Sperre eines Tages
// wieder verengt, denkt an den Code; wer den Rechtstext pflegt, sieht die Sperrmeldung nicht. Genau
// diese Kopplung hält dieser Sammler, damit sie nicht vom Gedächtnis abhängt.
//
// WAS ER PRÜFT: Beide Textstellen sagen in ALLEN DREI Sprachen dieselbe Reichweite, und KEINE von
// beiden behauptet mehr die alte Tab-Grenze. Er prüft ausdrücklich BEIDE Richtungen — eine
// Sperrmeldung, die mehr verspricht als der Rechtstext, ist genauso falsch wie umgekehrt.
//
// WAS ER AUSDRÜCKLICH NICHT PRÜFT: ob die Reichweite im CODE wirklich so ist. Das ist die Aufgabe
// von `apps/web/src/legal/mega64-sperre-alle-tabs.test.tsx` (gemountet, zwei Bäume, ein Speicher) und
// von `tests/legal/mega63-speicher-aufzaehlung.test.ts` (Speicherort und Ablaufzeit gegen den Code).
// Drei Sammler, drei verschiedene Fragen — kein vierter, der alles halb prüft.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const I18N = readFileSync(join(WURZEL, "apps/web/src/i18n.ts"), "utf8");

/** Alle Fassungen EINES Schlüssels in Dateireihenfolge — die drei Sprachblöcke von i18n.ts. */
function fassungen(schluessel: string): string[] {
  const muster = new RegExp(`"${schluessel.replace(/\./g, "\\.")}":\\s*\\n?\\s*"([^"]+)"`, "g");
  return [...I18N.matchAll(muster)].map((treffer) => treffer[1] ?? "");
}

const SPRACHEN = ["DE", "EN", "NL"] as const;

/**
 * Je Sprache: die Wendung, die die tabübergreifende Reichweite AUSSPRICHT, und die Wendung, mit der
 * die alte Tab-Grenze formuliert war. Die zweite Liste ist der eigentliche Wächter — sie ist der
 * wörtliche Ist-Stand aus mega63, und wer dorthin zurückgeht, wird davon getroffen.
 */
const REICHWEITE: Record<
  (typeof SPRACHEN)[number],
  { sagtAlleTabs: RegExp; alteTabGrenze: RegExp }
> = {
  DE: {
    sagtAlleTabs: /allen Fenstern und Tabs/,
    alteTabGrenze: /nur in dem Tab|gilt nur in diesem Tab|Tab schließen/,
  },
  EN: {
    sagtAlleTabs: /every window and tab/,
    alteTabGrenze: /only in the tab|close the tab/,
  },
  NL: {
    sagtAlleTabs: /alle vensters en tabbladen/,
    alteTabGrenze: /alleen in het tabblad|tabblad sluit/,
  },
};

describe("mega64 C · die Erhebung greift überhaupt", () => {
  it("beide Schlüssel stehen in genau drei Sprachfassungen und keine ist leer", () => {
    // Ein Sammler, der nichts findet, ist grün ohne zu prüfen — das wäre hier besonders bitter,
    // weil er gegen genau diese Sorte stiller Lücke steht.
    for (const schluessel of ["notice.signOutFailed.body", "legal.privacy.s4.p7"]) {
      const alle = fassungen(schluessel);
      expect(alle.length, `„${schluessel}" steht in ${alle.length} statt 3 Sprachfassungen`).toBe(
        3,
      );
      for (const [i, text] of alle.entries()) {
        expect(text.length, `${schluessel} (${SPRACHEN[i]}) ist leer`).toBeGreaterThan(80);
      }
    }
  });

  it("der Wächter auf die alte Tab-Grenze schlägt wirklich an (Kalibrierung)", () => {
    // Die wörtlichen mega63-Fassungen, gegen die dieser Sammler steht. Stünde hier ein Muster, das
    // nichts trifft, wäre die ganze Datei eine Beruhigung ohne Inhalt.
    const alt = {
      DE: "gilt nur in dem Tab, in dem der Fehler aufgetreten ist",
      EN: "applies only in the tab where the failure occurred",
      NL: "geldt alleen in het tabblad waarin de fout optrad",
    };
    for (const sprache of SPRACHEN) {
      expect(
        REICHWEITE[sprache].alteTabGrenze.test(alt[sprache]),
        `der ${sprache}-Wächter erkennt die alte Tab-Grenze nicht`,
      ).toBe(true);
    }
  });
});

describe("mega64 C · Sperrmeldung und Datenschutztext sagen dieselbe Reichweite", () => {
  it("BEIDE Stellen sprechen die tabübergreifende Reichweite aus — in allen drei Sprachen", () => {
    const sperre = fassungen("notice.signOutFailed.body");
    const recht = fassungen("legal.privacy.s4.p7");
    for (const [i, sprache] of SPRACHEN.entries()) {
      const muster = REICHWEITE[sprache].sagtAlleTabs;
      expect(
        muster.test(sperre[i] ?? ""),
        `die Sperrmeldung (${sprache}) nennt die Reichweite nicht`,
      ).toBe(true);
      expect(
        muster.test(recht[i] ?? ""),
        `der Datenschutztext (${sprache}) nennt die Reichweite nicht`,
      ).toBe(true);
    }
  });

  it("KEINE der beiden Stellen behauptet noch eine Tab-Grenze", () => {
    // Die Gegenrichtung, und sie ist die wichtigere: Solange die Sperre tabübergreifend gilt, ist
    // eine genannte Tab-Grenze eine FALSCHE Angabe — nicht bloß eine überholte.
    const verstoesse: string[] = [];
    for (const [i, sprache] of SPRACHEN.entries()) {
      const muster = REICHWEITE[sprache].alteTabGrenze;
      for (const [name, texte] of [
        ["Sperrmeldung", fassungen("notice.signOutFailed.body")],
        ["Datenschutztext", fassungen("legal.privacy.s4.p7")],
      ] as const) {
        if (muster.test(texte[i] ?? "")) {
          verstoesse.push(`${name} (${sprache}) nennt noch eine Tab-Grenze`);
        }
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it("die Sperrmeldung verspricht nichts, was der Datenschutztext nicht auch sagt", () => {
    // Der eigentliche Befund war eine EINSEITIGE Abweichung: Die Sperrmeldung sagte mehr. Deshalb
    // wird hier nicht bloß auf Gleichheit geprüft, sondern auf die drei Zusagen, die die
    // Sperrmeldung heute ausspricht — jede muss im Rechtstext ihre Entsprechung haben.
    const sperre = fassungen("notice.signOutFailed.body");
    const recht = fassungen("legal.privacy.s4.p7");
    const ZUSAGEN: Record<(typeof SPRACHEN)[number], Array<[string, RegExp, RegExp]>> = {
      DE: [
        ["Reichweite", /allen Fenstern und Tabs/, /allen Fenstern und Tabs/],
        ["Wiederholversuch", /von selbst erneut/, /von sich aus erneut|von selbst erneut/],
      ],
      EN: [
        ["Reichweite", /every window and tab/, /every window and tab/],
        ["Wiederholversuch", /retries ending the session by itself/, /retries ending the session/],
      ],
      NL: [
        ["Reichweite", /alle vensters en tabbladen/, /alle vensters en tabbladen/],
        ["Wiederholversuch", /zelf opnieuw/, /zelf opnieuw/],
      ],
    };
    const verstoesse: string[] = [];
    for (const [i, sprache] of SPRACHEN.entries()) {
      for (const [was, inSperre, inRecht] of ZUSAGEN[sprache]) {
        if (!inSperre.test(sperre[i] ?? "")) {
          verstoesse.push(`Sperrmeldung (${sprache}) sagt „${was}" nicht mehr`);
        } else if (!inRecht.test(recht[i] ?? "")) {
          verstoesse.push(
            `Sperrmeldung (${sprache}) verspricht „${was}", der Datenschutztext sagt es nicht`,
          );
        }
      }
    }
    expect(verstoesse).toEqual([]);
  });
});
