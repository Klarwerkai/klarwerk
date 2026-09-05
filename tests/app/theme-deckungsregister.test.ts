// ================================================================================================
// JOB 974 / D3 — DAS DECKUNGSREGISTER: WAS DIE THEME-WÄCHTER WIRKLICH DECKEN, UND WAS NICHT.
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI AUSGELÖST HAT (`_relay/kopf/outbox/BEN6-PRUEFUNG-JOB-974-D2.md`):
//
//   Prüflücke 4 · „jede der 22 bestehenden Regeln einer freigegebenen v2-Leitplanke ODER
//   ausdrücklich einer enger benannten Theme-/Kaskaden-Teildeckung zuordnen; nicht passende
//   Regeln dürfen nicht unter ‚Design-v2-Deckung' firmieren."
//
// Und die Krankheit dahinter, die BEN am Vorgänger beschrieben hat: ein Wächter, dessen NAME eine
// Deckung gegen ein Design-v2-Ziel verspricht, während sein INHALT den Bestand gegen sich selbst
// misst. Er war technisch stark und trotzdem keine v2-Deckung — weil es kein v2-Dokument gab, das
// er hätte messen können.
//
// GENAU DAS IST DER ZWEIG, DER OHNE OWNERENTSCHEIDUNG BAUBAR IST. Welche Leitplanken Design v2
// haben soll, entscheidet der Owner (Korrekturpflicht 1 und 2 des Urteils) — hier wird nichts
// erfunden. Baubar ist die zweite Hälfte von BENs Satz: die vorhandenen Wächter ausdrücklich einer
// ENG BENANNTEN Teildeckung zuordnen und dafür sorgen, dass keiner mehr verspricht, was er nicht
// hält.
//
// WAS DIESE DATEI DESHALB TUT — vier Zusicherungen, keine Buchhaltung:
//
//   1. SAMMLER, kein Katalog. Sie findet JEDEN Test, der `apps/web/src/styles/modern.css` liest.
//      Ein künftiger fünfter Wächter fällt automatisch hinein und muss sich erklären.
//   2. JEDE ZUORDNUNG IST AM INHALT GEPRÜFT. Ein Registereintrag behauptet nicht, er belegt: die
//      Quelle des Wächters muss die Merkmale tragen, ohne die seine Deckung gar nicht möglich wäre
//      (die WCAG-Leuchtdichte-Konstante bei einer Kontrastdeckung, der Themenanker bei einer
//      Invarianzdeckung). Ein Register, das sich selbst bescheinigt, wäre wertlos.
//   3. KEIN v2-ANSPRUCH OHNE v2-QUELLE. Solange `docs/design/design-v2-leitplanken.md` nicht
//      existiert, darf sich kein Test unter `tests/` als Design-v2-Deckung ausgeben — weder im
//      Dateinamen noch im Text. Das ist BENs Satz, ausführbar gemacht. Erscheint die Quelle, sagt
//      die Zusicherung es und verlangt die Nachführung, statt still weiterzulaufen.
//   4. DIE LÜCKE IST GEMESSEN, NICHT BEHAUPTET. Die fünf Achsen, die BEN und die D2-Rückgabe als
//      ungedeckt benannt haben, stehen hier als offene Posten mit ihrem Grund — sichtbar im Lauf.
//
// WAS SIE AUSDRÜCKLICH NICHT TUT: Sie legt kein v2-Ziel fest, erfindet keine Leitplanke, benennt
// keinen Wächter um und bewertet die Qualität der vier Wächter nicht. Sie hält fest, WAS sie
// decken — und verhindert, dass daraus mehr behauptet wird, als gemessen ist.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const TESTS = join(WURZEL, "tests");

/** Die Datei, die der Sammler sucht — der Gegenstand, um den es geht. */
const GEGENSTAND = "styles/modern.css";

/**
 * Die eigene Datei nimmt sich aus. Sie nennt `styles/modern.css` als SUCHBEGRIFF, sie liest die
 * Datei nicht — ein Register, das sich selbst registriert, sagt nichts aus. Die Ausnahme ist
 * genau eine, sie steht hier und die Kalibrierung unten zeigt, dass der Sammler trotzdem jede
 * andere Datei findet.
 */
const SELBST = "tests/app/theme-deckungsregister.test.ts";

/** Der Pfad, an dem eine ownerfreigegebene v2-Quelle läge (D2-Rückgabe §2.3, Vorschlag O-2). */
const V2_QUELLE = "docs/design/design-v2-leitplanken.md";

// ------------------------------------------------------------------------------------------------
// DAS REGISTER. Je Wächter genau eine eng benannte Teildeckung — und der Beleg, an dem sie hängt.
// ------------------------------------------------------------------------------------------------
//
// `beleg` sind bewusst GROBE, aber unfälschbare Merkmale: Dinge, ohne die die behauptete Deckung
// technisch unmöglich wäre. Feinere Muster (Funktionsnamen, Zeilen) würden diese Datei bei jeder
// Umbenennung im Nachbarn rot machen, ohne dass am Produkt etwas fehlte — das wäre ein Wächter,
// der Strenge misst statt Deckung.
type Eintrag = {
  waechter: string;
  teildeckung: string;
  aussage: string;
  beleg: { was: string; muster: RegExp }[];
};

const REGISTER: Eintrag[] = [
  {
    waechter: "tests/app/mega40-theme-invarianz.test.ts",
    teildeckung: "theme-invarianz",
    aussage:
      "Ohne das Attribut [data-theme=„modern“] ändert sich kein einziger berechneter Wert, " +
      "und jede Regel in modern.css hängt unter diesem Anker. Deckt die BINDUNG des Themas, " +
      "nicht sein Aussehen.",
    beleg: [
      {
        was: "der Themenanker selbst — ohne ihn kann der Test die Bindung nicht prüfen",
        muster: /\[data-theme="modern"\]/,
      },
    ],
  },
  {
    waechter: "tests/app/mega40-token-disziplin.test.ts",
    teildeckung: "token-disziplin",
    aussage:
      "Hex-Farben wohnen ausschließlich in der Token-Datei themes.css; keine andere Stilquelle " +
      "führt einen eigenen Farbwert. Deckt die EINE FARBQUELLE, nicht die Wahl der Farben.",
    beleg: [
      {
        was: "eine Suche nach Hex-Literalen — ohne sie gibt es keine Token-Disziplin",
        muster: /#\[0-9a-fA-F\]/,
      },
      { was: "themes.css als einzig erlaubte Heimat", muster: /themes\.css/ },
    ],
  },
  {
    waechter: "tests/app/mega40-kontrast-modern.test.ts",
    teildeckung: "kontrast-und-kaskade",
    aussage:
      "Texttragende Flächen des modernen Themas erreichen WCAG AA, gerechnet gegen die durch " +
      "modern.css TATSÄCHLICH wirksame Fläche (Quellreihenfolge der Regeln). Deckt Kontrast und " +
      "die Kaskadenwirkung der Regeln, nicht Raster, Rhythmus oder Navigationsmuster.",
    beleg: [
      {
        was: "die WCAG-Leuchtdichte-Konstante — ohne sie wird kein Kontrast gerechnet",
        muster: /0\.2126/,
      },
      { was: "die AA-Schwelle", muster: /4\.5/ },
      { was: "modern.css als gelesene Quelle der wirksamen Regeln", muster: /styles\/modern\.css/ },
    ],
  },
  {
    // JOB 3060 · H1: der Chromium-Messtest der Hülle nennt modern.css als Quelle der Kopfband-
    // Farben. Er deckt NUR das Kopfband gegen sein Mockup — nicht das Thema insgesamt.
    waechter: "tests/design/zielbild-h1-huelle.test.ts",
    teildeckung: "kopfband-zielbild",
    aussage:
      "Das Kopfband der gebauten App (Höhe, Farben, Schriftgrade, Gewichte, Abstände, Radius des " +
      "Suchfelds, Konto-Kreis) misst in Chromium die Werte des Mockups design/klarwerk/Main.dc.html " +
      "Z.17-33, unter der Vorgabe modern. Deckt die HÜLLE gegen ihr Zielbild, nicht das Thema.",
    beleg: [
      {
        was: "die Messung im echten Renderer — ohne getComputedStyle gibt es keinen Istwert",
        muster: /getComputedStyle/,
      },
      { was: "das Mockup als Sollwertquelle", muster: /Main\.dc\.html/ },
    ],
  },
  {
    waechter: "tests/legal/mega62-kontrast-pflichtflaechen.test.ts",
    teildeckung: "pflichtflaechen-kontrast",
    aussage:
      "Die rechtlich gebotenen Transparenzflächen (Art. 50 Abs. 5 KI-VO) erreichen AA in BEIDEN " +
      "Themen, und eine reale dunkle Paarung der modernen Seitenleiste wird aus modern.css " +
      "aufgelöst. Deckt die Pflichtflächen, nicht die Oberfläche insgesamt.",
    beleg: [
      { was: "die WCAG-Leuchtdichte-Konstante", muster: /0\.2126/ },
      { was: "die AA-Schwelle", muster: /4\.5/ },
      {
        was: "modern.css als gelesene Quelle des lokalen Overrides",
        muster: /styles\/modern\.css/,
      },
    ],
  },
];

// ------------------------------------------------------------------------------------------------
// DIE OFFENEN POSTEN. Nicht erfunden: wörtlich die Achsen, die die D2-Rückgabe (§2.3) als heute
// ungedeckt benannt hat und die BEN in Prüflücke 2 als Inhalt einer v2-Quelle erwartet.
// Sie stehen hier als MESSUNG des Fehlenden — nicht als Vorschlag, was sie sein sollen.
// ------------------------------------------------------------------------------------------------
const OHNE_DECKUNG: readonly string[] = [
  "Dichte/Raster",
  "Hierarchie/Typografie",
  "Navigationsmuster",
  "Zustands- und Leerflächen",
  "Bewegung/Reduktion",
];

// ------------------------------------------------------------------------------------------------
// Der Sammler.
// ------------------------------------------------------------------------------------------------

function testDateienUnter(dir: string): string[] {
  const raus: string[] = [];
  for (const eintrag of readdirSync(dir)) {
    const pfad = join(dir, eintrag);
    if (statSync(pfad).isDirectory()) {
      raus.push(...testDateienUnter(pfad));
    } else if (/\.test\.tsx?$/.test(eintrag)) {
      raus.push(pfad);
    }
  }
  return raus;
}

/** Jeder Test, der modern.css zum Gegenstand hat — eingesammelt, nicht aufgezählt. */
function waechterUeberModernCss(): string[] {
  const raus: string[] = [];
  for (const pfad of testDateienUnter(TESTS)) {
    const kurz = relative(WURZEL, pfad);
    if (kurz === SELBST) {
      continue;
    }
    if (readFileSync(pfad, "utf8").includes(GEGENSTAND)) {
      raus.push(kurz);
    }
  }
  return raus.sort();
}

const GEFUNDEN = waechterUeberModernCss();

/** Die Behauptung „Design-v2-Deckung" in Dateiname oder Text — die Form, die BEN verbietet. */
const V2_ANSPRUCH = /design[-_ ]?v2/i;

function v2Anspruechte(): string[] {
  const raus: string[] = [];
  for (const pfad of testDateienUnter(TESTS)) {
    const kurz = relative(WURZEL, pfad);
    if (kurz === SELBST) {
      continue;
    }
    if (V2_ANSPRUCH.test(kurz)) {
      raus.push(`${kurz} — der DATEINAME gibt sich als Design-v2-Deckung aus`);
      continue;
    }
    if (V2_ANSPRUCH.test(readFileSync(pfad, "utf8"))) {
      raus.push(`${kurz} — der TEXT beansprucht Design-v2-Deckung`);
    }
  }
  return raus;
}

describe("JOB 974 · R — das Deckungsregister der Theme-Wächter", () => {
  it("R1 · der Sammler findet die Wächter über modern.css — und läuft nicht ins Leere", () => {
    // Selbstschutz zuerst: ein Sammler, der nichts findet, wäre grün ohne zu prüfen. Genau diese
    // Sorte Grün hat das Urteil am Vorgänger beanstandet.
    expect(GEFUNDEN.length, "kein einziger Wächter über modern.css gefunden").toBeGreaterThan(0);
    expect(existsSync(join(WURZEL, "apps/web/src", GEGENSTAND)), `${GEGENSTAND} fehlt`).toBe(true);
  });

  it("R2 · JEDER gefundene Wächter ist genau einer eng benannten Teildeckung zugeordnet", () => {
    const registriert = new Set(REGISTER.map((e) => e.waechter));
    const ohneZuordnung = GEFUNDEN.filter((w) => !registriert.has(w));
    expect(
      ohneZuordnung,
      "Wächter über modern.css ohne Eintrag im Deckungsregister — er muss sagen, was er deckt, " +
        "sonst wächst wieder eine Deckung nach, die niemand benannt hat",
    ).toEqual([]);
    // Und genau EINE Zuordnung je Wächter: eine zweite wäre eine zweite Wahrheit.
    const doppelt = REGISTER.map((e) => e.waechter).filter((w, i, alle) => alle.indexOf(w) !== i);
    expect(doppelt, "Wächter mit zwei Teildeckungen").toEqual([]);
  });

  it("R3 · kein Registereintrag ist eine Leiche — jeder Wächter existiert und wird gefunden", () => {
    const leichen = REGISTER.filter((e) => !GEFUNDEN.includes(e.waechter)).map((e) => e.waechter);
    expect(
      leichen,
      "Registereintrag ohne Wächter — ein Eintrag auf Vorrat behauptet eine Deckung, die es " +
        "nicht gibt",
    ).toEqual([]);
  });

  it("R4 · jede Zuordnung ist AM INHALT belegt, nicht bloß behauptet", () => {
    const unbelegt: string[] = [];
    for (const eintrag of REGISTER) {
      const pfad = join(WURZEL, eintrag.waechter);
      if (!existsSync(pfad)) {
        continue; // von R3 erledigt
      }
      const quelle = readFileSync(pfad, "utf8");
      for (const beleg of eintrag.beleg) {
        if (!beleg.muster.test(quelle)) {
          unbelegt.push(
            `${eintrag.waechter} beansprucht „${eintrag.teildeckung}", trägt aber nicht ${beleg.was}`,
          );
        }
      }
      // Eine Aussage, die zu kurz ist, um eine Grenze zu ziehen, ist keine Zuordnung.
      if (eintrag.aussage.trim().length < 80) {
        unbelegt.push(`${eintrag.waechter}: die Aussage benennt keine Grenze`);
      }
    }
    expect(unbelegt, "Registereintrag ohne Beleg im Wächter selbst").toEqual([]);
  });

  it("R5 · solange keine v2-Quelle freigegeben ist, gibt sich KEIN Test als Design-v2-Deckung aus", () => {
    const quelle = join(WURZEL, V2_QUELLE);
    if (existsSync(quelle)) {
      // KEIN Defekt, sondern der Moment, auf den das Urteil wartet: die Ownerentscheidung ist
      // gefallen. Dann ist die Zuordnung gegen die Quelle neu zu führen — und das soll auffallen,
      // statt dass dieser Test still weiterläuft und eine überholte Lage bescheinigt.
      throw new Error(
        `${V2_QUELLE} existiert jetzt — die Zuordnung der Wächter ist gegen diese Quelle nachzuführen (BEN6 Prüflücke 4). Bis dahin ist dieses Register überholt.`,
      );
    }
    expect(
      v2Anspruechte(),
      "Ein Test gibt sich als Design-v2-Deckung aus, obwohl es keine freigegebene v2-Quelle gibt. " +
        "Genau diese Namensdeckung hat BEN6 beanstandet: der Name verspricht eine Deckung gegen " +
        "ein Ziel, das nirgends geschrieben steht.",
    ).toEqual([]);
  });

  it("R6 · die ungedeckten Achsen stehen als offener Posten, nicht als stille Lücke", () => {
    // Die Achsen kommen aus der Vorrückgabe und dem Urteil, nicht aus einer Erfindung dieser Datei.
    // Ihr Zweck hier: die Lücke ist BENANNT und im Lauf sichtbar. Wer künftig behauptet, das
    // moderne Thema sei „abgedeckt", hat diese Liste gegen sich.
    expect(OHNE_DECKUNG.length).toBeGreaterThanOrEqual(5);
    const gedeckt = REGISTER.map((e) => e.teildeckung);
    for (const achse of OHNE_DECKUNG) {
      expect(
        gedeckt,
        `„${achse}" wäre plötzlich gedeckt — dann fehlt hier die Nachführung`,
      ).not.toContain(achse);
    }
    const zeilen = REGISTER.map((e) => `  ${e.teildeckung.padEnd(24)} ${e.waechter}`).join("\n");
    console.log(
      `\nJOB 974 D3 — Deckungsregister (${REGISTER.length} Wächter über ${GEGENSTAND}):\n${zeilen}\n  OHNE DECKUNG (Quelle ${V2_QUELLE} fehlt): ${OHNE_DECKUNG.join(", ")}\n`,
    );
  });

  // ---- Kalibrierung: dieselben Funktionen, verstellte Eingabe -----------------------------------
  it("R7 · Kalibrierung: ein unbelegter Anspruch und eine v2-Namensdeckung schlagen an", () => {
    // (a) Ein Beleg, den der Wächter nicht trägt, wird gefunden — sonst wäre R4 eine Zierde.
    const quelle = readFileSync(join(WURZEL, "tests/app/mega40-token-disziplin.test.ts"), "utf8");
    expect(/0\.2126/.test(quelle), "die Token-Disziplin rechnet keinen Kontrast").toBe(false);
    // (b) Die Anspruchserkennung greift auf Name UND Text, in beiden Schreibweisen.
    expect(V2_ANSPRUCH.test("tests/app/design-v2-werkbank-deckung.test.ts")).toBe(true);
    expect(V2_ANSPRUCH.test("// dieser Test deckt Design V2 ab")).toBe(true);
    expect(V2_ANSPRUCH.test("tests/app/mega40-theme-invarianz.test.ts")).toBe(false);
    // (c) Der Sammler greift auf den Inhalt, nicht auf den Namen: eine Datei ohne `modern` im
    //     Namen wird gefunden, wenn sie modern.css liest — mega62 liegt sogar in tests/legal.
    expect(GEFUNDEN).toContain("tests/legal/mega62-kontrast-pflichtflaechen.test.ts");
  });
});
