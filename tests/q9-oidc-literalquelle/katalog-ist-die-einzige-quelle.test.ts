// ================================================================================================
// JOB 3562 · Q9-REST — DER MELDUNGSKATALOG IST DIE EINZIGE QUELLE SEINER TEXTE.
// ================================================================================================
//
// DER BEFUND, gegen den diese Datei steht (gemessen an main 8af8219):
//
//     services/auth/src/meldungen.ts:1    import { OIDC_UNREACHABLE_MESSAGE } from "./oidc";
//     services/auth/src/meldungen.ts:139    de: OIDC_UNREACHABLE_MESSAGE,
//     services/auth/src/oidc.ts:23        export const OIDC_UNREACHABLE_MESSAGE = "Anmeldedienst …";
//
// Der Katalog, der die Fehler des Anmeldedienstes ÜBERSETZT, holte sich eine seiner drei Fassungen
// aus genau dem Modul, dessen Fehler er übersetzt. Wer morgen `oidc.ts:23` umformuliert, ändert
// still einen Text, den Menschen in drei Sprachen sehen — und die EN- und NL-Fassung daneben sagen
// dann etwas anderes, ohne dass irgendein Test es merkt. `tests/q9-serverfehlertexte/katalog.test.ts`
// prüft nur, DASS drei nichtleere Fassungen da sind, nicht WOHER sie stammen; `OIDC_UNREACHABLE`
// bestand ihn deshalb problemlos.
//
// JOB 3449 hat die Lücke selbst benannt und offen gelassen, weil `oidc.ts` damals kein Zielpfad war
// (archiv/3449/runde-1/RUECKGABE.md:109,128; archiv/3449/runde-2/ben.md:31). Dieser Auftrag gibt den
// Pfad frei — und diese Datei macht aus der einmaligen Handsuche von damals
// (archiv/3449/runde-2/RUECKGABE.md:38: `git grep -F` über 26 Literale, einmal, von Hand) eine
// dauerhafte Zusage.
//
// DREI WÄCHTER, DREI VERSCHIEDENE FRAGEN — keiner ersetzt den anderen:
//
//   A  Ist der Katalog ein BLATT?      Importiert `meldungen.ts` aus irgendeinem Modul unter
//                                      services/auth/src? (Verhindert die Rückwärts-Abhängigkeit
//                                      und damit auch jeden Ringschluss.)
//   B  Ist jede Fassung ein LITERAL?   Steht bei jedem Schlüssel für de/en/nl eine Zeichenkette im
//                                      Quelltext von meldungen.ts — oder ein Bezeichner, dessen
//                                      Wert woanders liegt? (A allein reicht nicht: ein Bezeichner
//                                      aus `services/i18n` oder aus `node:process` bestünde A.)
//   C  Steht kein Text ZWEIMAL?        Kommt jede der drei Fassungen jedes Schlüssels im Quelltext
//                                      unter services/auth/src ausschliesslich in meldungen.ts vor?
//                                      (B allein reicht nicht: ein zweiter, kopierter Satz in
//                                      `service.ts` bestünde B — der Katalog wäre trotzdem nicht
//                                      mehr die eine Stelle.)
//
// W0.* kalibrieren vorher das Werkzeug, auf dem C steht: ein Kommentarschneider, der an einer URL
// oder einem Regex-Literal hängen bleibt, macht C stumm, ohne rot zu werden.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import { importe, ohneKommentare, zeileVon } from "./quelltext";

const WURZEL = resolve(__dirname, "..", "..");
const AUTH_SRC = join(WURZEL, "services", "auth", "src");
const KATALOG_DATEI = join(AUTH_SRC, "meldungen.ts");
const KATALOG_QUELLE = readFileSync(KATALOG_DATEI, "utf8");
const SPRACHEN = ["de", "en", "nl"] as const;

/**
 * Alle Fassungen als flache Liste — bewusst über die drei benannten Felder statt über einen
 * dynamischen Index: nur so bleibt jeder Text für den Typprüfer eine Zeichenkette, und eine fehlende
 * Sprache fällt beim Bauen auf statt erst als `undefined` mitten in einem Wächter.
 */
const FASSUNGEN: { schluessel: string; sprache: string; text: string }[] = Object.entries(
  MELDUNGEN,
).flatMap(([schluessel, texte]) => [
  { schluessel, sprache: "de", text: texte.de },
  { schluessel, sprache: "en", text: texte.en },
  { schluessel, sprache: "nl", text: texte.nl },
]);

function relativ(pfad: string): string {
  return relative(WURZEL, pfad).split("\\").join("/");
}

/** Alle `.ts`-Quelldateien unter services/auth/src, ohne die Testdateien, die dort mitliegen. */
function authQuellen(): string[] {
  const gefunden: string[] = [];
  const laufe = (ordner: string): void => {
    for (const eintrag of readdirSync(ordner).sort()) {
      const pfad = join(ordner, eintrag);
      if (statSync(pfad).isDirectory()) {
        laufe(pfad);
        continue;
      }
      if (!pfad.endsWith(".ts") || pfad.endsWith(".d.ts") || pfad.endsWith(".test.ts")) {
        continue;
      }
      gefunden.push(pfad);
    }
  };
  laufe(AUTH_SRC);
  return gefunden;
}

// ------------------------------------------------------------------------------------------------
// W0 · KALIBRIERUNG DES WERKZEUGS
// ------------------------------------------------------------------------------------------------
describe("W0 · der Kommentarschneider, auf dem Wächter C steht", () => {
  it("W0.1 schneidet Zeilen- und Blockkommentare heraus und lässt die Zeilen stehen", () => {
    const quelle = [
      'const a = 1; // "Satz A"',
      '/* Zeile1 "Satz B"',
      'Zeile2 */ const b = "echt";',
    ].join("\n");
    const rein = ohneKommentare(quelle);
    expect(rein).not.toContain("Satz A");
    expect(rein).not.toContain("Satz B");
    expect(rein).toContain('const b = "echt";');
    expect(rein.split("\n")).toHaveLength(3);
  });

  it("W0.2 hält Zeichenketten und Vorlagen fest, auch wenn Kommentarzeichen darin stehen", () => {
    const quelle = 'const u = "https://klarwerk.example/x"; const v = `a/*b${" /* c "}d`;';
    const rein = ohneKommentare(quelle);
    expect(rein).toBe(quelle);
  });

  it("W0.3 verwechselt ein Regex-Literal nicht mit einem Kommentaranfang", () => {
    const quelle = 'const t = /https?:\\/\\//.test(x); const s = "danach";';
    const rein = ohneKommentare(quelle);
    expect(rein).toContain("danach");
  });

  it("W0.4 hält eine Division für eine Division und schneidet danach weiter", () => {
    const quelle = "const q = a / b; // weg\nconst r = 2;";
    const rein = ohneKommentare(quelle);
    expect(rein).not.toContain("weg");
    expect(rein).toContain("const r = 2;");
  });

  it("W0.5 der geschnittene Katalog trägt alle Fassungen noch — der Schneider frisst keine Texte", () => {
    const rein = ohneKommentare(KATALOG_QUELLE);
    for (const { schluessel, sprache, text } of FASSUNGEN) {
      if (typeof text !== "string" || text.trim() === "") {
        continue; // Ein fehlender Text ist ein Katalogdefekt und gehört C.0, nicht dem Schneider.
      }
      expect(rein.includes(text), `${schluessel}.${sprache} vom Schneider verschluckt`).toBe(true);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// A · DER KATALOG IST EIN BLATT
// ------------------------------------------------------------------------------------------------
//
// RUNDE 2 — WAS BEN FAND: Die Prüfung unten ist dieselbe Aussage wie in Runde 1, aber sie hielt sie
// nicht. Ihr Muster kannte nur `from "…"`, `import("…")` und `require("…")`. Ein Import OHNE
// BINDUNG — `import "./types";` — hat weder `from` noch Klammer und blieb deshalb unsichtbar: Ben
// setzte ihn vor den Katalog und alle fünfzehn Fälle blieben grün (BEN, Runde 1: „→ Exit 0,
// `Tests 15 passed (15)`. Wächter A bleibt trotz verbotener Abhängigkeit grün."). Ein Wächter, der
// seine eigene Zusage nicht hält, ist schlimmer als keiner: er beruhigt.
// Zwei Änderungen: das Erkennen der Modulangaben liegt jetzt in `importe()` (quelltext.ts), und
// A.0.* misst dieses Erkennen an jeder Importform EINZELN — auch an der, die gefehlt hat. Damit ist
// die Gegenprobe des Prüfers dauerhaft im Lauf, statt einmal von Hand gefahren worden zu sein.

/**
 * Die Verstösse, die Wächter A in einem Quelltext sieht — als Funktion, damit A.0 sie an
 * erfundenen Quellen messen kann und A selbst an der echten Datei. Beides läuft durch denselben
 * Code; eine Kalibrierung an einer Kopie des Wächters wäre keine.
 */
function blattVerstoesse(quelle: string, datei = "meldungen.ts"): string[] {
  const rein = ohneKommentare(quelle);
  const verstoesse: string[] = [];
  for (const { spezifizierer, index } of importe(rein)) {
    if (!spezifizierer.startsWith(".")) {
      continue; // node:crypto, jose … liegen ausserhalb des Moduls und sind erlaubt.
    }
    const ziel = resolve(AUTH_SRC, spezifizierer);
    if (ziel === join(AUTH_SRC, "meldungen") || !ziel.startsWith(AUTH_SRC)) {
      continue;
    }
    verstoesse.push(`${datei}:${zeileVon(rein, index)} importiert ${spezifizierer}`);
  }
  return verstoesse;
}

describe("A.0 · Wächter A sieht jede Form, in der ein Modul geladen werden kann", () => {
  const GESEHEN: { form: string; quelle: string; erwartet: string[] }[] = [
    // Die Form, die in Runde 1 durchrutschte. Sie steht bewusst zuerst.
    {
      form: "Import ohne Bindung",
      quelle: 'import "./types";\n',
      erwartet: ["X.ts:1 importiert ./types"],
    },
    {
      form: "Standardbindung",
      quelle: 'import katalog from "./oidc";\n',
      erwartet: ["X.ts:1 importiert ./oidc"],
    },
    {
      form: "benannte Bindung",
      quelle: 'import { AuthError } from "./types";\n',
      erwartet: ["X.ts:1 importiert ./types"],
    },
    {
      form: "reine Typbindung",
      quelle: 'import type { Role } from "./types";\n',
      erwartet: ["X.ts:1 importiert ./types"],
    },
    {
      form: "Namensraumbindung",
      quelle: 'import * as alles from "./service";\n',
      erwartet: ["X.ts:1 importiert ./service"],
    },
    {
      form: "Wiederausfuhr",
      quelle: 'export { OidcUnreachableError } from "./oidc";\n',
      erwartet: ["X.ts:1 importiert ./oidc"],
    },
    {
      form: "Stern-Wiederausfuhr",
      quelle: 'export * from "./oidc";\n',
      erwartet: ["X.ts:1 importiert ./oidc"],
    },
    {
      form: "dynamischer Import",
      quelle: 'const m = await import("./oidc");\n',
      erwartet: ["X.ts:1 importiert ./oidc"],
    },
    {
      form: "require",
      quelle: 'const m = require("./oidc");\n',
      erwartet: ["X.ts:1 importiert ./oidc"],
    },
    {
      form: "mehrzeilige Bindung — die Zeile der Anweisung, nicht die des Wortes import",
      quelle: 'import {\n  AuthError,\n} from "./types";\n',
      erwartet: ["X.ts:3 importiert ./types"],
    },
  ];

  for (const { form, quelle, erwartet } of GESEHEN) {
    it(`A.0 sieht: ${form}`, () => {
      expect(blattVerstoesse(quelle, "X.ts")).toEqual(erwartet);
    });
  }

  const UEBERSEHEN: { form: string; quelle: string }[] = [
    { form: "Fremdmodul mit node:-Präfix", quelle: 'import { createHash } from "node:crypto";\n' },
    { form: "Fremdmodul aus node_modules", quelle: 'import { jwtVerify } from "jose";\n' },
    { form: "Modul ausserhalb von services/auth/src", quelle: 'import { x } from "../../i18n";\n' },
    { form: "auskommentierter Import", quelle: '// import "./types";\nconst a = 1;\n' },
    { form: "eine Zeichenkette, die nur wie ein Pfad aussieht", quelle: 'const p = "./types";\n' },
    { form: "ein Aufruf, der zufällig from heisst", quelle: 'const a = Array.from("./types");\n' },
  ];

  for (const { form, quelle } of UEBERSEHEN) {
    it(`A.0 schlägt NICHT an bei: ${form}`, () => {
      // Ein Wächter, der bei Harmlosem rot wird, wird beim ersten Fehlalarm abgeschaltet — dann
      // ist auch die echte Zusage weg. Diese Fälle halten die Grenze.
      expect(blattVerstoesse(quelle, "X.ts")).toEqual([]);
    });
  }
});

it("A · meldungen.ts importiert aus keinem anderen Modul unter services/auth/src", () => {
  const verstoesse = blattVerstoesse(KATALOG_QUELLE);
  expect(
    verstoesse,
    `Der Meldungskatalog muss ein Blatt bleiben: er übersetzt die Fehler der anderen Module
und darf seine Texte deshalb aus keinem von ihnen beziehen.
Gefunden: ${verstoesse.join(" · ")}`,
  ).toEqual([]);
});

// ------------------------------------------------------------------------------------------------
// B · JEDE FASSUNG IST EIN LITERAL
// ------------------------------------------------------------------------------------------------
describe("B · jede Sprachfassung steht als Zeichenkette in meldungen.ts", () => {
  // Der Katalogblock wird aus dem GESCHNITTENEN Quelltext gelesen, damit ein auskommentierter
  // Alteintrag nicht als gültiger Eintrag zählt.
  const rein = ohneKommentare(KATALOG_QUELLE);
  const anfang = rein.indexOf("export const MELDUNGEN = {");
  const ende = rein.indexOf("} as const satisfies", anfang);
  const block = anfang >= 0 && ende > anfang ? rein.slice(anfang, ende) : "";
  const versatz = anfang >= 0 ? anfang : 0;

  type Eintrag = { schluessel: string; sprache: string; wert: string; zeile: number };
  const eintraege: Eintrag[] = [];
  {
    let schluessel = "";
    let index = versatz;
    for (const zeilentext of block.split("\n")) {
      const kopf = /^\s{2}([A-Z0-9_]+):\s*\{\s*$/.exec(zeilentext);
      if (kopf?.[1]) {
        schluessel = kopf[1];
      }
      const feld = /^\s{4}(de|en|nl):\s*(.+?),\s*$/.exec(zeilentext);
      if (feld?.[1] && feld[2] && schluessel) {
        eintraege.push({
          schluessel,
          sprache: feld[1],
          wert: feld[2],
          zeile: zeileVon(rein, index),
        });
      }
      index += zeilentext.length + 1;
    }
  }

  it("B.0 der Katalogblock ist lesbar und vollständig erfasst", () => {
    expect(anfang, "export const MELDUNGEN = { nicht gefunden").toBeGreaterThanOrEqual(0);
    expect(ende, "Abschluss `} as const satisfies` nicht gefunden").toBeGreaterThan(anfang);
    const erfasst = eintraege.map((e) => `${e.schluessel}.${e.sprache}`).sort();
    const erwartet = Object.keys(MELDUNGEN)
      .flatMap((k) => SPRACHEN.map((s) => `${k}.${s}`))
      .sort();
    // Ohne diesen Abgleich wäre B stumm zu machen, indem man einen Eintrag so umformt, dass die
    // Zeilenlesung ihn nicht mehr findet — dann prüfte B nur noch die Einträge, die brav aussehen.
    expect(erfasst).toEqual(erwartet);
  });

  it("B.1 kein Sprachwert ist ein Bezeichner", () => {
    const literal = /^"(?:[^"\\]|\\.)*"$/;
    const verstoesse = eintraege
      .filter((e) => !literal.test(e.wert))
      .map(
        (e) =>
          `${e.schluessel}.${e.sprache} ist kein Literal (meldungen.ts:${e.zeile}) → ${e.wert}`,
      );
    expect(
      verstoesse,
      `Alle drei Fassungen einer Meldung müssen nebeneinander lesbar sein.
Ein Bezeichner verlagert eine davon aus dem Blickfeld: ${verstoesse.join(" · ")}`,
    ).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// C · KEIN KATALOGTEXT STEHT EIN ZWEITES MAL
// ------------------------------------------------------------------------------------------------
it("C.0 jede Fassung ist zur Laufzeit eine nichtleere Zeichenkette — sonst sucht C ins Blaue", () => {
  // GEFUNDEN IN GEGENPROBE 2 dieses Auftrags: wird eine Fassung durch einen Bezeichner ersetzt, den
  // es nicht gibt, ist ihr Laufzeitwert `undefined`. `indexOf(undefined)` sucht dann nach dem Wort
  // „undefined" — und C meldete sieben Fundorte in Dateien, die mit der Meldung nichts zu tun
  // haben. Ein Wächter, der bei einem Defekt Unsinn meldet, wird beim ersten Mal abgeschaltet.
  // Dieser Fall trennt die beiden Aussagen: hier bricht der DEFEKT auf, in C nur die Doppelung.
  const kaputt = FASSUNGEN.filter((f) => typeof f.text !== "string" || f.text.trim() === "").map(
    (f) => `${f.schluessel}.${f.sprache}`,
  );
  expect(kaputt, `Fassungen ohne Text: ${kaputt.join(" · ")}`).toEqual([]);
});

it("C · jede Katalogfassung kommt unter services/auth/src nur in meldungen.ts vor", () => {
  // Gesucht wird die GANZE Fassung, nicht ein Wortteil: „Account nicht gefunden." ist ein Text, den
  // ein Mensch liest; „Account" ist ein Wort, das überall vorkommen darf. Eine Teilsuche wäre eine
  // Zusage, die niemand halten kann, und würde nach dem ersten Fehlalarm abgeschaltet.
  // Ausgenommen sind Kommentare (Prosa erklärt, sie liefert nicht aus) und die Testdateien, die
  // unter services/auth/src mitliegen (ein Test MUSS den erwarteten Satz nennen dürfen — sonst
  // prüfte er nur noch den Katalog gegen sich selbst).
  const fundorte: string[] = [];
  for (const pfad of authQuellen()) {
    if (pfad === KATALOG_DATEI) {
      continue;
    }
    const roh = readFileSync(pfad, "utf8");
    const rein = ohneKommentare(roh);
    for (const { schluessel, sprache, text } of FASSUNGEN) {
      if (typeof text !== "string" || text.trim() === "") {
        continue; // Der Defekt gehört C.0; C sucht nur nach Texten, die es wirklich gibt.
      }
      const stelle = rein.indexOf(text);
      if (stelle >= 0) {
        fundorte.push(`${relativ(pfad)}:${zeileVon(rein, stelle)} trägt ${schluessel}.${sprache}`);
      }
    }
  }
  expect(
    fundorte,
    `Der Meldungskatalog ist die eine Stelle, an der diese Texte geändert werden — dort sieht
der Mensch alle drei Sprachen zugleich. Ein zweiter Satz derselben Bedeutung anderswo
läuft still auseinander: ${fundorte.join(" · ")}`,
  ).toEqual([]);
});
