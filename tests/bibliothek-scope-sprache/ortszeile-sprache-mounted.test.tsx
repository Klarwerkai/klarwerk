// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import i18n from "../../apps/web/src/i18n";
import { ORTSZEILE_WORTE } from "../support/ortszeileWorte";
import { repoPfad } from "../support/repoPfad";

// JOB 3576 · Lieferung 6 — die neun Solltexte standen hier abgeschrieben (`const worte`) und noch
// zweimal anderswo. Sie kommen jetzt aus `tests/support/ortszeileWorte.ts`; die Datei ist ebenso
// unabhängig von `i18n` wie es dieses Literal war, und Fall 10 hält fest, dass es die einzige
// Stelle bleibt.
const sprachen = Object.keys(i18n.options.resources ?? {});
/** `Meine Ablage` — das Probewort der Scanner-Fälle 9 und 12, aus der einen Quelle. */
const MEINE = ORTSZEILE_WORTE.de.meine;
// JOB 3565 · Lieferung 4 — die geführten Sprachen stehen hier UNABHÄNGIG von `i18n`, damit Fall 7
// eine echte Gegenaussage hat und nicht die Laufzeitquelle mit sich selbst vergleicht.
const GEFUEHRTE_SPRACHEN = ["de", "en", "nl"];
const schluessel = ["lib.ownScope.label", "lib.ownScope.meine", "lib.ownScope.alle"];

// JOB 3565 · Lieferung 2 — Pedis Begründung für die Ortszeile, wörtlich. Quelle des Wortlauts ist
// das Codex-Urteil zu JOB 3489 (`archiv/3489/runde-1/ben.md:35`); die dort zitierte
// Entscheidungsdatei `ENTSCHEIDUNGEN/JOB-381-ORTSZEILE.md` existiert in keinem Commit dieses Repos.
// Der Kommentarkopf von `libraryOwnScope.ts` ist damit der letzte Ort, an dem der Satz steht — und
// genau deshalb hat er hier einen Wächter (Fall 6).
const PEDIS_SATZ =
  "„Die Zeile muss wirken, nicht nur aussehen. 'Meine Ablage' filtert auf createdBy des " +
  'angemeldeten Nutzers. Eine Schaltflaeche ohne Wirkung waere eine Attrappe."';
const bestand = [
  { id: "eigen", title: "Eigener Beitrag", author: "fremd", history: [{ author: "ich" }] },
  { id: "fremd", title: "Fremder Beitrag", author: "ich", history: [{ author: "fremd" }] },
  { id: "unbekannt", title: "Ohne Historie", author: "ich", history: [] },
].map((ko) => ({
  statement: "",
  conditions: [],
  measures: [],
  type: "best_practice",
  category: "Anlage",
  tags: [],
  confidence: 0,
  trust: 0,
  status: "validiert",
  version: 1,
  originalAuthor: "fremd",
  neededValidations: 2,
  assignments: [],
  asset: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  ...ko,
})) as unknown as KnowledgeObject[];

/**
 * JOB 3565 · Lieferung 1 — TypeScript-Quelltext ohne Kommentare, Zeichenketten UNVERÄNDERT.
 *
 * Die Trennung von Code und Kommentar macht NICHT dieser Test, sondern der TypeScript-Parser
 * selbst: die Datei wird geparst, und übrig bleibt genau das, was der Parser als Token sieht.
 * Kommentare sind für ihn Trivia und stehen in keinem Token; JSDoc-Blöcke hängen als eigene Knoten
 * am Baum und werden hier verworfen. Alles andere — Zeichenketten, Templates, Regex-Literale —
 * bleibt Zeichen für Zeichen erhalten, an seiner ursprünglichen Stelle (Kommentartext wird durch
 * Leerzeichen ersetzt, Zeilenumbrüche bleiben, damit Zeilennummern stimmen).
 *
 * WARUM NICHT VON HAND: die erste Fassung dieses Jobs lief zeichenweise und schätzte, wo eine
 * Zeichenkette beginnt. Codex fand daran zwei echte Fehler (Urteil zu Runde 1, Korrekturpflicht 1):
 * ein Regex-Literal `/\/\//` wurde als Kommentarbeginn gelesen — alles dahinter, auch ein deutsches
 * Anzeigetext-Literal, verschwand ungeprüft; und ein Kommentar innerhalb eines `${…}`-Ausdrucks
 * blieb stehen, weil der Backtick als durchgehende Zeichenkette galt. Die damals dort behauptete
 * „bewusste Grenze, folgenlos" war falsch: sie kostete Fall 5 die Schärfe. Beide Fälle stehen jetzt
 * als Proben in `scannerProben` und werden von Fall 9 dauerhaft gehalten.
 */
function ohneKommentare(quelle: string, art: ts.ScriptKind = ts.ScriptKind.TS): string {
  // JOB 3576: `art` kam dazu, weil Fall 10 auch eine `.tsx`-Datei liest. Eine TSX-Quelle als TS
  // geparst ergibt einen Baum mit Syntaxfehlern — der Parser wirft nicht, er rät weiter, und die
  // Maske daraus wäre still falsch. Die Vorgabe bleibt `TS`, damit Fall 5 und Fall 9 unverändert
  // rufen.
  const datei = ts.createSourceFile("probe.ts", quelle, ts.ScriptTarget.Latest, true, art);
  const istCode = new Array<boolean>(quelle.length).fill(false);
  const sammle = (knoten: ts.Node): void => {
    // JSDoc-Knoten (`/** … */`) hängen als Kinder am Baum — sie sind Kommentar, nicht Code.
    if (knoten.kind >= ts.SyntaxKind.FirstJSDocNode && knoten.kind <= ts.SyntaxKind.LastJSDocNode) {
      return;
    }
    const kinder = knoten.getChildren(datei);
    if (kinder.length === 0) {
      for (let i = knoten.getStart(datei); i < knoten.getEnd(); i += 1) istCode[i] = true;
      return;
    }
    for (const kind of kinder) sammle(kind);
  };
  sammle(datei);
  let aus = "";
  for (let i = 0; i < quelle.length; i += 1) {
    const zeichen = quelle[i] as string;
    aus += istCode[i] || zeichen === "\n" ? zeichen : " ";
  }
  return aus;
}

/**
 * JOB 3565 · Runde 2 — der Scanner hat jetzt selbst einen Wächter (Fall 9).
 *
 * Beide Lücken, die Codex an der Runde-1-Fassung von `ohneKommentare` fand, stehen hier als Probe:
 * ein deutsches Anzeigetext-Literal HINTER einem Regex-Literal muss stehen bleiben (sonst übersieht
 * Fall 5 es), ein deutscher Kommentar INNERHALB eines `${…}`-Ausdrucks muss fallen (sonst vertreibt
 * Fall 5 erneut einen Kommentar — genau der Schaden, den dieser Job repariert).
 *
 * `true` = der Text steht danach noch da (Code), `false` = er ist weg (Kommentar).
 */
const scannerProben: ReadonlyArray<readonly [string, string, boolean]> = [
  // JOB 3576: die Proben schreiben das Wort nicht mehr ab, sie setzen es aus der Quelle ein —
  // sonst wäre diese Datei ihr eigener Fund (Fall 10). Geprüft wird unverändert dasselbe.
  ["Zeilenkommentar fällt", `// ${MEINE}\nconst a = "x";`, false],
  ["Blockkommentar fällt", `/* ${MEINE} */\nconst a = "x";`, false],
  ["JSDoc fällt", `/**\n * ${MEINE}\n */\nexport const a = "x";`, false],
  ["Kommentar im Template-Ausdruck fällt", `const a = \`\${/* ${MEINE} */ 1}\`;`, false],
  ["Kommentar hinter Code fällt", `const a = "x"; // ${MEINE}`, false],
  ["Zeichenkette bleibt", `const a = "${MEINE}";`, true],
  ["Zeichenkette mit `//` darin bleibt", `const a = "https://host/${MEINE}";`, true],
  [
    "Zeichenkette hinter einem Regex bleibt",
    `const a = /\\/\\//.test("x") ? "${MEINE}" : "";`,
    true,
  ],
  ["Template bleibt", `const a = \`${MEINE}\`;`, true],
];

// ==================================================================================================
// JOB 3576 · DIE NEUN WORTE STEHEN NUR NOCH IN DER QUELLE (Fall 10, kalibriert von Fall 12).
// ==================================================================================================
//
// WARUM ES DIESEN WÄCHTER GIBT. Bis JOB 3576 standen dieselben neun Beschriftungen dreimal im
// Testbaum, jedes Mal abgeschrieben (`tests/support/ortszeileWorte.ts` nennt die drei Stellen mit
// Zeilennummern). Ein Wächter, der nur die Ablösung von heute festhält, wäre in einer Woche wieder
// weich: die vierte Abschrift entsteht beim nächsten Test, der „schnell mal" die Erwartung
// danebenschreibt. Dieser Fall macht genau das rot.
//
// ER MUSS DIE UMWEGE KENNEN, sonst ist er keiner (Lehre JOB 3564 R2: ein Wächter, der nur die
// offensichtliche Form sieht, hängt an der Schreibweise statt an der Sache). Deshalb ZWEI Schnitte
// über dieselbe Datei:
//
//   (1) DER BREITE SCHNITT über den Quelltext OHNE Kommentare — `ohneKommentare` aus JOB 3565, kein
//       zweiter Filter daneben. Er trifft jede Form, die das Wort zusammenhängend hinschreibt:
//       das schlichte Literal, die lokale Konstante, das Regex-Literal, den Falltitel.
//   (2) DER UMWEG-SCHNITT über den Syntaxbaum. Er FALTET zusammengesetzte Ausdrücke zu ihrem Wert:
//       `"Meine " + "Ablage"`, `` `Meine ${"Ablage"}` ``, und — weil der Parser Escapes auflöst —
//       auch `"Meine Ablage"`, das im Quelltext gar nicht wie das Wort aussieht.
//
// WAS ER NICHT SIEHT, ausdrücklich benannt und in Fall 12 als Probe festgehalten: eine erst zur
// LAUFZEIT entstehende Zusammensetzung (`vorn + trenner + hinten`). Dafür bräuchte es eine
// Auswertung statt eines Parsers. Die Faltung setzt an solchen Stellen eine Lücke (`LUECKE`) ein,
// statt die Nachbarn zusammenzuziehen — sonst meldete sie Worte, die nirgends stehen.
//
// KOMMENTARE UND BEGRÜNDUNGEN bleiben frei: sie stehen im Quelltext von (1) nicht mehr und sind im
// Baum von (2) keine Knoten. Das ist die Lehre aus JOB 3565 — ein Fall, der Kommentare mitverbietet,
// vertreibt Pedis Begründungen aus dem Baum.
const WORTQUELLE = "tests/support/ortszeileWorte.ts";

/** Die vier Dateien, die die Worte seit JOB 3576 nicht mehr abschreiben dürfen. */
const ABGELOESTE_DATEIEN = [
  "tests/design/h4-funktionsinventar.test.ts",
  "tests/design/h4-harness.ts",
  "tests/bibliothek-scope-sprache/ortszeile-390px-browser.test.ts",
  "tests/bibliothek-scope-sprache/ortszeile-sprache-mounted.test.tsx",
] as const;

/** Die neun Worte — aus der einen Quelle, nicht abgeschrieben. */
const NEUN_WORTE = Object.values(ORTSZEILE_WORTE).flatMap((w) => [w.label, w.meine, w.alle]);

/**
 * FREIGESTELLT ist GENAU EINE Deklaration, und sie heißt so: `PEDIS_SATZ` in dieser Datei.
 *
 * Pedis Begründung zitiert die deutsche Beschriftung wörtlich (Fall 6). Das ist ein HISTORISCHES
 * ZITAT und keine Beschriftung: Es darf sich nicht mit der Wortquelle ändern. Würde der Satz seinen
 * Namen aus `ORTSZEILE_WORTE` beziehen, wäre Fall 6 in dem Augenblick rot, in dem jemand die
 * Beschriftung umbenennt — obwohl Pedi denselben Satz gesagt hat. Deshalb steht er weiter wörtlich
 * da, und diese Ausnahme trägt seinen Namen statt seinen Text.
 *
 * Die Freistellung ist keine Tür: sie gilt für die Deklaration dieses einen Namens, nicht für den
 * Text. Ein zweites Literal mit demselben Wortlaut daneben ist weiterhin rot (Fall 12).
 */
const FREIGESTELLT = "PEDIS_SATZ";

/** Steht hier ein WORT — oder nur ein Wortteil wie `ownScope` in `libraryOwnScope.ts`? */
function istWort(text: string, ab: number, wort: string): boolean {
  const rand = /[A-Za-z0-9_]/;
  const davor = ab > 0 ? (text[ab - 1] as string) : " ";
  const danach = ab + wort.length < text.length ? (text[ab + wort.length] as string) : " ";
  return !rand.test(davor) && !rand.test(danach);
}

function baumVon(datei: string, quelle: string): ts.SourceFile {
  return ts.createSourceFile(
    datei,
    quelle,
    ts.ScriptTarget.Latest,
    true,
    datei.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

interface Bereich {
  von: number;
  bis: number;
}

/** Der Quellbereich der freigestellten Deklaration — `null`, wenn die Datei sie nicht hat. */
function freistellung(sf: ts.SourceFile): Bereich | null {
  let bereich: Bereich | null = null;
  const gang = (n: ts.Node): void => {
    if (bereich !== null) {
      return;
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === FREIGESTELLT) {
      bereich = { von: n.getStart(sf), bis: n.getEnd() };
      return;
    }
    n.forEachChild(gang);
  };
  gang(sf);
  return bereich;
}

/**
 * FALLTITEL ZÄHLEN NICHT — die zweite benannte Ausnahme, und sie ist gemessen, nicht vorsorglich.
 *
 * Die erste Fassung dieses Wächters las Titel mit. Sie meldete daraufhin
 * `ortszeile-sprache-mounted.test.tsx:585` — den Titel „%s · Texte bleiben sichtbar und Scope
 * bedienbar". Dort steht „Scope" als gewöhnliches Wort eines deutschen Satzes und nicht als die
 * englische Beschriftung; der Fund war falsch. Ein Titel ist eine Beschriftung des Falls, keine
 * Erwartung: er kann nichts prüfen und nichts abschreiben, was jemand nachziehen müsste (Lehre
 * JOB 3570 R1 — ein Kommentar oder Titel darf nie als Ersatz einer ausführbaren Erwartung zählen).
 *
 * Die Ausnahme deckt genau das erste Argument von `it`/`test`/`describe`, auch in der Form
 * `it.each(tabelle)("…")` und `describe.skip("…")`, und NUR wenn es eine Zeichenkette ist.
 */
const TITELRUFER = new Set(["it", "test", "describe"]);

function ruferName(ausdruck: ts.Expression): string | null {
  if (ts.isIdentifier(ausdruck)) {
    return ausdruck.text;
  }
  if (ts.isPropertyAccessExpression(ausdruck)) {
    return ruferName(ausdruck.expression);
  }
  if (ts.isCallExpression(ausdruck)) {
    return ruferName(ausdruck.expression);
  }
  return null;
}

/** Die Quellbereiche aller Falltitel dieser Datei. */
function titelbereiche(sf: ts.SourceFile): Bereich[] {
  const bereiche: Bereich[] = [];
  const gang = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const erstes = n.arguments[0];
      const name = ruferName(n.expression);
      if (
        erstes !== undefined &&
        name !== null &&
        TITELRUFER.has(name) &&
        (ts.isStringLiteral(erstes) ||
          ts.isNoSubstitutionTemplateLiteral(erstes) ||
          ts.isTemplateExpression(erstes))
      ) {
        bereiche.push({ von: erstes.getStart(sf), bis: erstes.getEnd() });
      }
    }
    n.forEachChild(gang);
  };
  gang(sf);
  return bereiche;
}

/**
 * Platzhalter für einen Ausdruck, dessen Wert erst zur Laufzeit entsteht.
 *
 * Bewusst ein Zeichen, das in keiner Beschriftung vorkommen kann, und bewusst NICHT das
 * Leerzeichen: mit einem Leerzeichen würde `"Meine" + x + "Ablage"` zu genau dem Wort, und der
 * Wächter meldete etwas, das im Quelltext nirgends steht. Lieber eine benannte Lücke als ein
 * falsches Rot — dieselbe Richtung wie `seiten-typ-waechter.test.ts`: milder, nie falsch-rot.
 */
const LUECKE = "\u0000";

/** Der Wert eines Ausdrucks, soweit er schon im Quelltext feststeht — sonst `null`. */
function gefaltet(n: ts.Node): string | null {
  if (
    ts.isStringLiteral(n) ||
    ts.isNoSubstitutionTemplateLiteral(n) ||
    ts.isRegularExpressionLiteral(n)
  ) {
    return n.text;
  }
  if (ts.isTemplateExpression(n)) {
    let aus = n.head.text;
    for (const span of n.templateSpans) {
      aus += (gefaltet(span.expression) ?? LUECKE) + span.literal.text;
    }
    return aus;
  }
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return (gefaltet(n.left) ?? LUECKE) + (gefaltet(n.right) ?? LUECKE);
  }
  if (ts.isParenthesizedExpression(n)) {
    return gefaltet(n.expression);
  }
  return null;
}

interface Wortfund {
  datei: string;
  zeile: number;
  wort: string;
  /** In welcher Form das Wort dasteht — für die Meldung, die der nächste Leser braucht. */
  form: string;
}

/** Jede Stelle, an der eine der neun Beschriftungen in dieser Datei als Wert entsteht. */
function wortfunde(datei: string, quelle: string): Wortfund[] {
  const sf = baumVon(datei, quelle);
  const frei = freistellung(sf);
  const ausgenommen: Bereich[] = [...(frei === null ? [] : [frei]), ...titelbereiche(sf)];
  const funde = new Map<string, Wortfund>();
  const melde = (zeile: number, wort: string, form: string): void => {
    const schluessel = `${zeile}:${wort}`;
    if (!funde.has(schluessel)) {
      funde.set(schluessel, { datei, zeile, wort, form });
    }
  };

  // (1) Der breite Schnitt: Quelltext ohne Kommentare, die Freistellung ausmaskiert. Ausmaskiert
  // wird zeichenweise OHNE die Zeilenumbrüche — sonst verschöben sich alle Zeilennummern danach.
  let code = ohneKommentare(quelle, datei.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const b of ausgenommen) {
    const maske = [...code.slice(b.von, b.bis)].map((z) => (z === "\n" ? "\n" : " ")).join("");
    code = code.slice(0, b.von) + maske + code.slice(b.bis);
  }
  for (const wort of NEUN_WORTE) {
    for (let ab = code.indexOf(wort); ab >= 0; ab = code.indexOf(wort, ab + 1)) {
      if (istWort(code, ab, wort)) {
        melde(code.slice(0, ab).split("\n").length, wort, "Literal im Quelltext");
      }
    }
  }

  // (2) Der Umweg-Schnitt: zusammengesetzte, eingesetzte und geschriebene Formen.
  const gang = (n: ts.Node): void => {
    if (ausgenommen.some((b) => n.getStart(sf) >= b.von && n.getEnd() <= b.bis)) {
      return;
    }
    const wert = gefaltet(n);
    if (wert !== null) {
      const zeile = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      for (const wort of NEUN_WORTE) {
        for (let ab = wert.indexOf(wort); ab >= 0; ab = wert.indexOf(wort, ab + 1)) {
          if (istWort(wert, ab, wort)) {
            melde(zeile, wort, "zusammengesetzt oder eingesetzt");
          }
        }
      }
    }
    n.forEachChild(gang);
  };
  gang(sf);
  return [...funde.values()].sort((a, b) => a.zeile - b.zeile);
}

function fundzeile(f: Wortfund): string {
  return `${f.datei}:${f.zeile} · „${f.wort}" (${f.form})`;
}

/** Was ein roter Fall 10 dem nächsten Leser sagen muss: wohin die Beschriftung gehört und warum. */
const FUND_HINWEIS = `Diese Stellen schreiben eine Beschriftung der Ortszeile ab. Sie gehört nach ${WORTQUELLE} und wird von dort gelesen — sonst muss jede Umbenennung an mehreren Orten nachgezogen werden, und wer einen vergisst, merkt es nicht (Codex zu JOB 3489, ben.md:29).`;

/**
 * DIE KALIBRIERUNG (Fall 12): derselbe Verstoß in jeder Schreibweise, als Quelltext im Speicher.
 *
 * Vorbild ist `tests/design-vorrichtung/seiten-typ-waechter.test.ts` (V4, JOB 3564): die Gegenprobe
 * steht dauerhaft im Lauf, statt einmal von Hand gefahren worden zu sein. Die Proben schreiben das
 * Wort NICHT ab — sie setzen es aus der Quelle ein, sonst wäre diese Datei ihr eigener Fund.
 */
const [VORN = "", HINTEN = ""] = MEINE.split(" ");
/** `Ablage` mit dem ersten Zeichen als `\uXXXX` — im Quelltext unsichtbar, im Baum aufgelöst. */
const ESCAPED = `\\u${HINTEN.charCodeAt(0).toString(16).padStart(4, "0")}${HINTEN.slice(1)}`;

const wortproben: ReadonlyArray<readonly [string, string, boolean]> = [
  ["schlichtes Literal", `const a = "${MEINE}";`, true],
  ["lokale Konstante", `const EIGEN = "${MEINE}";\nexport const b = EIGEN;`, true],
  ["Falltitel zählt nicht (die benannte Ausnahme)", `it("F08 · ${MEINE}", () => {});`, false],
  [
    "Titelausnahme ist keine Tür: im Rumpf zählt es",
    `it("F08", () => { const a = "${MEINE}"; });`,
    true,
  ],
  ["Titelausnahme gilt auch für `it.each`", `it.each(t)("F08 · ${MEINE} %s", () => {});`, false],
  ["Zusammensetzung zweier Literale", `const a = "${VORN} " + "${HINTEN}";`, true],
  ["Template mit eingesetztem Literal", `const a = \`${VORN} \${"${HINTEN}"}\`;`, true],
  ["Template mit dem Wort im Kopf", `const a = \`${MEINE} \${x}\`;`, true],
  ["Escape-Schreibweise", `const a = "${VORN} ${ESCAPED}";`, true],
  ["Regex-Literal", `const a = /${MEINE}/.test(x);`, true],
  ["Zeilenkommentar", `// ${MEINE}\nconst a = "x";`, false],
  ["Blockkommentar", `/* ${MEINE} */\nconst a = "x";`, false],
  [
    "Wortteil wie in `libraryOwnScope.ts`",
    'const a = "apps/web/src/lib/libraryOwnScope.ts";',
    false,
  ],
  [
    "Laufzeit-Zusammensetzung (die benannte Grenze)",
    `const a = "${VORN} " + x + "${HINTEN}";`,
    false,
  ],
  [
    `Freistellung: die Deklaration ${FREIGESTELLT}`,
    `const ${FREIGESTELLT} = "… ${MEINE} …";`,
    false,
  ],
  [
    "Freistellung ist keine Tür: dasselbe Wort daneben",
    `const ${FREIGESTELLT} = "… ${MEINE} …";\nconst b = "${MEINE}";`,
    true,
  ],
];

const lage = vi.hoisted(() => ({ zustand: "erfolgreich" }));
function query() {
  const cache = lage.zustand.startsWith("Cache");
  const fehler = lage.zustand === "Fehler" || lage.zustand === "Cache gescheitert";
  return {
    data:
      cache || lage.zustand === "erfolgreich" ? bestand : lage.zustand === "leer" ? [] : undefined,
    isLoading: lage.zustand === "laden",
    isFetching: lage.zustand === "laden" || lage.zustand === "Cache laufend",
    isError: fehler,
    isRefetchError: fehler && cache,
    isStale: cache,
    fetchStatus:
      lage.zustand === "offline"
        ? "paused"
        : lage.zustand === "laden" || lage.zustand === "Cache laufend"
          ? "fetching"
          : "idle",
    dataUpdatedAt: cache || lage.zustand === "erfolgreich" ? Date.parse("2026-09-01T10:00:00Z") : 0,
    error: fehler ? new Error("Abruf fehlgeschlagen") : null,
  };
}
vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = (data: unknown) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => query(),
    useLibrarySearch: () => query(),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
    useEigeneBefunde: () => ok([]),
    useAudit: () => ok([]),
    useKo: () => ({ data: undefined, isLoading: true, isError: false, error: null }),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "ich", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | undefined;
let client: QueryClient;
function Adresse() {
  return createElement("span", { "data-adresse": useLocation().search });
}
async function mount(sprache: string) {
  await i18n.changeLanguage(sprache);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/bibliothek?sonstwas=behalten"] },
          createElement(Adresse),
          createElement(BibliothekFlaeche),
        ),
      ),
    );
  });
}
function el(id: string): HTMLElement {
  const element = container.querySelector(`[data-testid="${id}"]`);
  expect(element, id).toBeInstanceOf(HTMLElement);
  return element as HTMLElement;
}
function pruefeTexte(sprache: string) {
  const soll = ORTSZEILE_WORTE[sprache as keyof typeof ORTSZEILE_WORTE];
  expect(soll, `unabhängige Solltexte für ${sprache}`).toBeDefined();
  expect(el("bib-scope-meine").textContent).toBe(soll.meine);
  expect(el("bib-scope-alle").textContent).toBe(soll.alle);
  expect(el("library-scope-bar").querySelector("fieldset")?.getAttribute("aria-label")).toBe(
    soll.label,
  );
  expect(el("library-scope-bar").textContent).toBe(soll.meine + soll.alle);
  expect(
    [...el("library-scope-bar").querySelectorAll("button")].map((b) => b.dataset.testid),
  ).toEqual(["bib-scope-meine", "bib-scope-alle"]);
}
beforeEach(() => {
  lage.zustand = "erfolgreich";
  localStorage.clear();
});
afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = undefined;
    container.remove();
    client.clear();
  }
  await i18n.changeLanguage("de");
  vi.restoreAllMocks();
});

describe("JOB 3489 · Ortszeile spricht die gewählte Sprache", () => {
  it.each(sprachen)(
    "Fall 1/2 · gemountete Beschriftungen und zugänglicher Gruppenname in %s",
    async (sprache) => {
      await mount(sprache);
      pruefeTexte(sprache);
    },
  );
  it("Fall 3 · DE → EN → DE hält Wahl, URL, Trefferzahl und eigene Treffermenge", async () => {
    await mount("de");
    expect(container.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(3);
    await act(async () => el("bib-scope-meine").click());
    const vorher = el("bib-fuss").textContent;
    expect(vorher).toBe("1 Eintrag");
    const adresse = container.querySelector("[data-adresse]")?.getAttribute("data-adresse");
    expect(new URLSearchParams(adresse ?? "").get("raum")).toBe("meine");
    for (const sprache of ["en", "de"]) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      pruefeTexte(sprache);
      expect(el("bib-scope-meine").getAttribute("aria-pressed")).toBe("true");
      expect(el("bib-scope-alle").getAttribute("aria-pressed")).toBe("false");
      expect(el("library-scope-bar").dataset.raum).toBe("meine");
      expect(container.querySelector("[data-adresse]")?.getAttribute("data-adresse")).toBe(adresse);
      expect(container.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(1);
      expect(el("bib-zeile").textContent).toContain("Eigener Beitrag");
      expect(el("bib-fuss").textContent).toBe(sprache === "en" ? "1 entry" : vorher);
    }
    await act(async () => el("bib-scope-alle").click());
    expect(container.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(3);
  });
  it.each(sprachen)(
    "Fall 4 · Katalogwerte in %s existieren ohne Rückfall und unterscheiden sich von DE",
    (sprache) => {
      expect(sprachen.sort()).toEqual(Object.keys(ORTSZEILE_WORTE).sort());
      for (const key of schluessel) {
        const wert: unknown = i18n.getResource(sprache, "translation", key);
        expect(typeof wert, key).toBe("string");
        expect(String(wert).trim(), key).not.toBe("");
        if (sprache !== "de")
          expect(wert, key).not.toBe(i18n.getResource("de", "translation", key));
      }
    },
  );
  it("Fall 5 · keine deutschen Beschriftungen mehr in Zugehörigkeitsmodul und Ortszeile", () => {
    // JOB 3565 · Lieferung 1 — geprüft werden CODEZEILEN, nicht Kommentare. Der Fall verbot die drei
    // Wortlaute zuvor im GANZEN Dateiinhalt und war damit strenger als sein Auftrag (JOB 3489 §5.3:
    // „keine deutschen ANZEIGETEXTE"). Genau das hat Pedis Begründung aus dem Kopf der Datei
    // vertrieben (`archiv/3489/runde-1/ben.md:35`). Die Absicht bleibt scharf: ein deutsches
    // Anzeigetext-Literal im Code macht den Fall weiterhin rot — Gegenprobe (a) in der Rückgabe.
    const modul = ohneKommentare(
      readFileSync(repoPfad("apps/web/src/lib/libraryOwnScope.ts"), "utf8"),
    );
    const flaeche = readFileSync(
      repoPfad("apps/web/src/components/bibliothek/BibliothekFlaeche.tsx"),
      "utf8",
    );
    const ort = flaeche.slice(flaeche.indexOf("ortszeile={"), flaeche.indexOf("segment={segment}"));
    expect(ort).toContain('data-testid="library-scope-bar"');
    for (const wort of Object.values(ORTSZEILE_WORTE.de)) {
      expect(modul).not.toContain(wort);
      expect(ort).not.toContain(wort);
    }
  });
  it("Fall 6 · Pedis Wortlaut steht wörtlich im Zugehörigkeitsmodul", () => {
    // Der Kommentarkopf darf umbrechen, wie er will — verglichen wird der FLIESSTEXT: Zeilenpräfixe
    // (`//`, `*`) fallen weg, Folgen von Leerraum werden zu einem Leerzeichen.
    const fliesstext = readFileSync(repoPfad("apps/web/src/lib/libraryOwnScope.ts"), "utf8")
      .replace(/^[ \t]*(\/\/|\*)[ \t]?/gm, "")
      .replace(/\s+/g, " ");
    expect(fliesstext).toContain(PEDIS_SATZ);
  });
  it("Fall 7 · genau drei geführte Sprachen — die Prüfmenge kann nicht lautlos schrumpfen", () => {
    // AUSSERHALB jedes `it.each`: `sprachen` speist Fall 1/2, Fall 4 und die 18 Zustandsfälle. Wäre
    // `i18n.options.resources` leer oder nachgeladen, verschwänden die alle spurlos — dieser Fall
    // ist der einzige, der das rot macht (Codex zu JOB 3489, `ben.md:29`/`:43`).
    expect([...sprachen].sort()).toEqual([...GEFUEHRTE_SPRACHEN].sort());
  });
  it.each(scannerProben)("Fall 9 · Kommentarentfernung: %s", (name, quelle, erwartet) => {
    expect(ohneKommentare(quelle).includes(ORTSZEILE_WORTE.de.meine), name).toBe(erwartet);
  });
  it("Fall 10 · die neun Worte stehen nur noch in der Quelle, in keinem der vier Verbraucher", () => {
    const funde = ABGELOESTE_DATEIEN.flatMap((datei) =>
      wortfunde(datei, readFileSync(repoPfad(datei), "utf8")),
    );
    expect(funde.map(fundzeile), FUND_HINWEIS).toEqual([]);
  });
  it("Fall 11 · die Prüfmenge trägt: die Quelle hat die neun Worte, die Freistellung ist kein Gespenst", () => {
    // Ohne diesen Fall wäre Fall 10 auch dann grün, wenn `NEUN_WORTE` leer liefe oder die Quelle
    // die Worte gar nicht mehr führte (Lehre JOB 3489, `LEHREN.md` 10.09. 09:21:13).
    expect(NEUN_WORTE.length).toBe(9);
    expect(new Set(NEUN_WORTE).size, "die neun Worte sind neun verschiedene").toBe(9);
    const quelle = readFileSync(repoPfad(WORTQUELLE), "utf8");
    expect(
      NEUN_WORTE.filter((wort) => !quelle.includes(wort)),
      WORTQUELLE,
    ).toEqual([]);
    // Und die eine Ausnahme: `PEDIS_SATZ` gibt es noch, und sie wird gebraucht — stünde die
    // Beschriftung nicht mehr darin, wäre die Freistellung ein Gespenst und gehörte gelöscht
    // (dieselbe Regel wie `seiten-typ-waechter.test.ts` V2 für seinen Altbestand).
    const selbst = ABGELOESTE_DATEIEN[3];
    const sf = baumVon(selbst, readFileSync(repoPfad(selbst), "utf8"));
    const bereich = freistellung(sf);
    expect(bereich, `${FREIGESTELLT} steht nicht mehr in ${selbst}`).not.toBeNull();
    expect(PEDIS_SATZ, "die Freistellung deckt nichts mehr").toContain(ORTSZEILE_WORTE.de.meine);
  });
  it.each(wortproben)("Fall 12 · Wortwächter kalibriert: %s", (name, quelle, erwartet) => {
    expect(wortfunde("probe.ts", quelle).length > 0, name).toBe(erwartet);
  });
  it("Fall 8 · `lib.menue.geltungsbereich` ist in keiner Sprache mehr bekannt", () => {
    // Gemessen vor dem Löschen: der Schlüssel trug in allen drei Sprachen exakt die Werte von
    // `lib.ownScope.label` und hatte ausserhalb von `i18n.ts` keinen einzigen Verbraucher
    // (`grep -rn "lib.menue.geltungsbereich" apps services tests tests-smoke extensions`).
    for (const sprache of GEFUEHRTE_SPRACHEN) {
      expect(
        i18n.getResource(sprache, "translation", "lib.menue.geltungsbereich"),
        sprache,
      ).toBeUndefined();
      // Die verbleibende eine Stelle bleibt bedienbar — sonst wäre das Löschen ein Verlust.
      expect(typeof i18n.getResource(sprache, "translation", "lib.ownScope.label"), sprache).toBe(
        "string",
      );
    }
  });
  describe.each(sprachen)("Zustandsmodell in %s", (sprache) => {
    it.each(["laden", "leer", "Fehler", "Cache laufend", "Cache gescheitert", "offline"])(
      "%s · Texte bleiben sichtbar und Scope bedienbar",
      async (zustand) => {
        lage.zustand = zustand;
        await mount(sprache);
        pruefeTexte(sprache);
        expect(el("library-scope-bar").closest("[hidden]")).toBeNull();
        expect(el("library-scope-bar").querySelector("[disabled]")).toBeNull();
        await act(async () => el("bib-scope-meine").click());
        expect(el("library-scope-bar").dataset.raum).toBe("meine");
        pruefeTexte(sprache);
        if (zustand.startsWith("Cache")) {
          expect(container.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(1);
          expect(el("bib-zeile").textContent).toContain("Eigener Beitrag");
        }
      },
    );
  });
});
