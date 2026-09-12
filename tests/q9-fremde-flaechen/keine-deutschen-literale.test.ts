// ================================================================================================
// JOB 3568 · Q9-FREMDE-FLÄCHEN — DER DAUERWÄCHTER GEGEN DEN RÜCKFALL.
// ================================================================================================
//
// Die Laufzeitfälle in `wachter-sprache.test.ts` und `interne-antwort.test.ts` belegen die DREI
// Stellen, die diese Runde übersetzt. Sie belegen nichts über die VIERTE, die morgen jemand
// dazuschreibt. Genau so ist der Befund entstanden, den dieser Auftrag behebt: JOB 3449 hat die
// Anmeldung vollständig übersetzt, und zwei Dateien weiter stand der deutsche Satz weiter im Code,
// weil kein Wächter ihn verbot (`archiv/3449/runde-2/ben.md:38`).
//
// ------------------------------------------------------------------------------------------------
// ÜBER DEN SYNTAXBAUM UND NICHT ÜBER ZEICHENKETTEN
// ------------------------------------------------------------------------------------------------
// Beide überwachten Dateien sind dicht kommentiert, und die Kommentare NENNEN die Sätze, um die es
// geht („Der Meldungstext selbst bleibt unverändert", „Nicht angemeldet."). Ein Kommentar ist keine
// zweite Textquelle: er wird nicht ausgeliefert, niemand liest ihn als Nutzertext, und ihn zu
// verbieten hiesse, Begründungen zu verbieten — die Lehre aus JOB 3489, wörtlich: „Die
// Quelltextprobe sucht nur in CODEZEILEN, nicht in Kommentaren."
//
// Statt Kommentare herauszuschneiden und dann zu suchen, fragt dieser Wächter den TypeScript-AST.
// Dort kommen Kommentare gar nicht erst vor — dieselbe Wahl und derselbe Grund wie in
// `tests/capture/aufrufer-waechter.test.ts:18-29`. Es gibt keinen Abtaster, der danebengreifen
// könnte, und die gemeldete Zeilennummer ist die echte.
//
// ------------------------------------------------------------------------------------------------
// DIE ZWEI REGELN — und warum die erste ohne jede Sprachheuristik auskommt
// ------------------------------------------------------------------------------------------------
// REGEL 1 (`message-literal`): Keine `message:`-Eigenschaft darf eine Zeichenkette oder eine
//   Vorlagenzeichenkette als Wert haben. Das ist der harte Kern und enthält KEINE Vermutung
//   darüber, welche Sprache ein Text hat: ein Meldungstext gehört in den Katalog, egal in welcher
//   Sprache er dasteht. Ein Bezeichner oder ein Aufruf als Wert ist erlaubt — sonst fiele der
//   Domänenzweig `http.ts:155-157` darunter, der die Meldung des Fachfehlers durchreicht und
//   ausdrücklich nicht zu dieser Runde gehört (SCRUM-496).
//
// REGEL 2 (`send-literal`): In keinem Argument eines `…send(…)`-Aufrufs darf eine Zeichenkette mit
//   deutschem Fließtext stehen. Das ist das Netz unter Regel 1 für den Fall, dass ein Satz nicht
//   unter `message:` steht, sondern etwa positionell übergeben wird. Hier IST eine Heuristik nötig
//   (was ist deutscher Fließtext?), und deshalb ist sie eng an `send` gebunden: Ein Log-Satz wie
//   `reply.log.error(…, "Interner Betriebsfehler maskiert …")` ist deutscher Fließtext im Code,
//   geht aber an niemanden nach draußen und bleibt deshalb — richtigerweise — unbehelligt.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 · DIE AUSNAHME DECKT EINE STELLE, NICHT EINEN TEXT (Korrekturpflicht 1, BEN)
// ------------------------------------------------------------------------------------------------
// BENs Gegenprobe zu Runde 1, wörtlich: „In `guard.ts` vor der Rollenauflösung einen zusätzlichen,
// über `x-ben-probe` erreichbaren Antwortzweig mit `message: \"Keine Berechtigung.\"` eingefügt;
// bestehende Ausnahme unverändert → `Tests 39 passed (39)`, obwohl eine weitere deutsche
// Meldungsstelle entstanden ist."
//
// Der Fehler lag im SCHLÜSSEL der Ausnahme. Runde 1 fragte `AUSNAHMEN.some(a => a.datei === f.datei
// && a.literal === f.literal)` — damit stellte EIN Listeneintrag jedes beliebig häufige Vorkommen
// desselben Satzes frei. Eine Ausnahme begründet aber immer nur die EINE Stelle, für die sie
// geschrieben wurde; ein zweiter Sendezweig mit demselben Wortlaut ist eine NEUE Meldungsstelle und
// braucht den Katalog wie jede andere. Es ist derselbe Fehler und dieselbe Korrektur wie bei der
// nativen Modal-Ausnahme in `tools/modalgrenze.ts:437-481` (mega76 BLOCK E): die Ausnahme hängt am
// FUND, nicht an der Datei und nicht am Text.
//
// ZWEI ÄNDERUNGEN TRAGEN DAS:
//  (a) `beurteile` verlangt je Ausnahme GENAU EINEN Träger. Null Träger heisst „die Ausnahme ist
//      eine Zusage von gestern", zwei oder mehr heissen „hier ist eine Stelle dazugekommen". Beide
//      Fälle sind rot, und gedeckt ist ausschliesslich der eine Fund, den die Ausnahme wirklich
//      meint — jeder weitere steht wieder in `unerlaubt`.
//  (b) Ein Fund wird an seiner AST-POSITION unterschieden, nicht an Zeile+Text. Runde 1
//      entdoppelte über `datei:zeile:literal`; zwei verschiedene Knoten auf DERSELBEN Quelltextzeile
//      wären damit zu einem einzigen Fund verschmolzen (BENs Prüflücke 6). `pos` ist die
//      Knotenidentität: zwei Knoten haben nie denselben Startversatz, derselbe Knoten hat nie zwei.
//
// Beide Mutationen sind als DAUERHAFTE Fälle in R7 festgeschrieben und laufen bei jedem Tor mit —
// sie sind nicht bloss einmal von Hand gefahren worden.
//
// WAS DIESER WÄCHTER AUSDRÜCKLICH NICHT LEISTET: Ein deutscher Satz, der WEDER unter `message:`
// steht NOCH in einem `send(…)`-Argument — etwa in einer Hilfsfunktion, die ihn erst später
// weiterreicht — fällt durch. Das ist die Prüflücke dieser Datei, hier benannt und nicht
// verschwiegen. Beide überwachten Dateien sind heute klein und haben keine solche Zwischenstufe.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { type Quelle, ladeQuelle, quelleAus, zeileVon } from "../../tools/modalgrenze";

/** Die überwachte Fläche — die zwei modulübergreifenden Wächter dieses Auftrags. */
const DATEIEN = ["services/app/src/http.ts", "services/rbac/src/guard.ts"] as const;

/**
 * BEWUSST STEHENGELASSEN — jede Zeile mit Grund, geprüft am Code.
 *
 * Auftrag §10.1: Für beide Sätze gibt es KEINEN passenden Katalogschlüssel. `MELDUNGEN`
 * (`services/auth/src/meldungen.ts`) kennt `ADMIN_REQUIRED`, aber nichts Allgemeines für „ein Recht
 * fehlt"; `http.ts` setzt zusätzlich einen dynamischen Wert in den Satz. Einen Schlüssel anzulegen
 * hiesse `meldungen.ts` anzufassen — die Datei gehört JOB 3562. Beide Stellen sind Folgezeile,
 * nicht „mit erledigt".
 *
 * JEDE AUSNAHME DECKT GENAU EINE STELLE (Runde 2, Korrekturpflicht 1). Verschwindet das Literal,
 * ohne dass diese Zeile mitverschwindet, wird `beurteile` rot; kommt ein ZWEITES Vorkommen
 * desselben Satzes dazu, ebenfalls — auch auf derselben Quelltextzeile. Eine Liste, die nur wächst
 * und nie schrumpft, und eine Ausnahme, die einen Text statt einer Stelle freistellt, wären beide
 * der Anfang vom Ende dieses Wächters.
 */
interface Ausnahme {
  readonly datei: string;
  /** Der Quelltext des Literals, so wie er dasteht — samt Anführungszeichen bzw. Backticks. */
  readonly literal: string;
  readonly grund: string;
}

const AUSNAHMEN: readonly Ausnahme[] = [
  {
    datei: "services/rbac/src/guard.ts",
    literal: '"Keine Berechtigung."',
    grund:
      "403 FORBIDDEN. Kein Katalogschlüssel für „keine Berechtigung“ vorhanden; ein neuer Schlüssel " +
      "hiesse services/auth/src/meldungen.ts anfassen, und die Datei gehört JOB 3562 (Auftrag §10.1).",
  },
  {
    datei: "services/app/src/http.ts",
    literal: "`Recht fehlt: ${permission}`",
    grund:
      "403 FORBIDDEN mit dynamischem Rechtenamen im Satz — dafür gibt es im Katalog weder einen " +
      "Schlüssel noch eine Einsetzstelle. Zusätzlich pinnt tests/app/i-834-ab-r1-r5-guardvertrag.test.ts:170 " +
      'den Satz "Recht fehlt: users.manage" wörtlich (Auftrag §10.1).',
  },
];

/**
 * Deutscher Fließtext (nur für Regel 2). Gesucht wird ein deutsches Funktionswort oder ein Wort aus
 * dem engen Meldungswortschatz als GANZES Wort — `"Bearer "`, `"kw_session"`, `"NOT_FOUND"` und
 * jeder Modulpfad fallen damit durch, ohne dass sie einzeln aufgezählt werden müssten.
 */
const DEUTSCHER_FLIESSTEXT =
  /(^|[^\p{L}])(der|die|das|den|dem|des|ein|eine|einen|einem|eines|kein|keine|keinen|nicht|ist|sind|war|wurde|wird|fehlt|fehlen|bitte|erforderlich|ungültig|ungueltig|unbekannt|unerwarteter|angemeldet|berechtigung|fehler|recht|rechte|und|oder|für|fuer|von|zu|mit|auf|nur|noch|schon)($|[^\p{L}])/iu;

type Literal = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression;

function istLiteral(n: ts.Node): n is Literal {
  return (
    ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)
  );
}

/** Der reine Textanteil eines Literals — bei Vorlagen ohne die eingesetzten Ausdrücke. */
function textAnteil(n: Literal): string {
  if (ts.isTemplateExpression(n)) {
    return n.head.text + n.templateSpans.map((s) => s.literal.text).join(" ");
  }
  return n.text;
}

interface Fund {
  readonly datei: string;
  readonly zeile: number;
  /** 1-basiert, nur für die Fehlermeldung: zwei Funde einer Zeile bleiben unterscheidbar lesbar. */
  readonly spalte: number;
  /**
   * Der Startversatz des Literals im Quelltext — die KNOTENIDENTITÄT (Runde 2, Korrekturpflicht 1).
   * Zwei verschiedene AST-Knoten haben nie denselben `pos`, derselbe Knoten nie zwei. Deshalb
   * entdoppelt `pos` genau das, was entdoppelt gehört (derselbe Knoten über beide Regeln gefunden),
   * und zieht niemals zwei Meldungsstellen einer Zeile zusammen.
   */
  readonly pos: number;
  /** Der Quelltext des Literals, wie er dasteht — der Abgleich gegen die Ausnahmeliste. */
  readonly literal: string;
  readonly regel: "message-literal" | "send-literal";
}

/** Die Marke eines Fundes: Datei plus Knotenidentität. NICHT die Zeile, NICHT der Text. */
function marke(f: Fund): string {
  return `${f.datei}:${f.pos}`;
}

function zeigeFund(f: Fund): string {
  return `${f.datei}:${f.zeile}:${f.spalte} [${f.regel}] ${f.literal}`;
}

/** Ist `n` ein Aufruf der Form `irgendwas.send(…)`? */
function istSendAufruf(n: ts.Node): n is ts.CallExpression {
  return (
    ts.isCallExpression(n) &&
    ts.isPropertyAccessExpression(n.expression) &&
    n.expression.name.text === "send"
  );
}

/** Heisst diese Eigenschaft `message`? Auch `"message": …` zählt. */
function istMessageEigenschaft(n: ts.PropertyAssignment): boolean {
  const name = n.name;
  return (
    (ts.isIdentifier(name) && name.text === "message") ||
    (ts.isStringLiteral(name) && name.text === "message")
  );
}

interface Erhebung {
  readonly datei: string;
  readonly funde: Fund[];
  readonly anweisungen: number;
  readonly leseFehler: string[];
}

/**
 * Der EINE Sammler. Er nimmt eine `Quelle` statt eines Pfades, damit R7 denselben Sammler auf einen
 * mutierten Quelltext werfen kann, ohne eine Datei anzufassen und ohne die Logik ein zweites Mal
 * hinzuschreiben — eine Erhebung, mehrere Aufrufer (derselbe Grundsatz wie `tools/modalgrenze.ts`).
 */
function erhebeAus(quelle: Quelle): Erhebung {
  const sf = quelle.ast;
  const datei = quelle.datei;
  const roh: Fund[] = [];

  const melde = (n: Literal, regel: Fund["regel"]): void => {
    const pos = n.getStart(sf);
    roh.push({
      datei,
      zeile: zeileVon(sf, n),
      spalte: sf.getLineAndCharacterOfPosition(pos).character + 1,
      pos,
      literal: n.getText(sf),
      regel,
    });
  };

  const literaleIn = (wurzel: ts.Node, regel: Fund["regel"], nurDeutsch: boolean): void => {
    const gehe = (n: ts.Node): void => {
      if (istLiteral(n) && (!nurDeutsch || DEUTSCHER_FLIESSTEXT.test(textAnteil(n)))) {
        melde(n, regel);
        // In eine Vorlagenzeichenkette wird weiter abgestiegen: `${…}` kann selbst Literale tragen.
      }
      ts.forEachChild(n, gehe);
    };
    gehe(wurzel);
  };

  const gehe = (n: ts.Node): void => {
    if (ts.isPropertyAssignment(n) && istMessageEigenschaft(n) && istLiteral(n.initializer)) {
      melde(n.initializer, "message-literal");
    }
    if (istSendAufruf(n)) {
      for (const arg of n.arguments) {
        literaleIn(arg, "send-literal", true);
      }
    }
    ts.forEachChild(n, gehe);
  };
  ts.forEachChild(sf, gehe);

  // Derselbe KNOTEN kann über beide Regeln kommen (`send({ message: "…" })`). Gemeldet wird er
  // einmal. Zwei verschiedene Knoten — auch mit gleichem Text auf gleicher Zeile — bleiben zwei.
  const gesehen = new Set<string>();
  const funde = roh
    .filter((f) => {
      if (gesehen.has(marke(f))) {
        return false;
      }
      gesehen.add(marke(f));
      return true;
    })
    .sort((a, b) => a.pos - b.pos);

  return { datei, funde, anweisungen: sf.statements.length, leseFehler: quelle.leseFehler };
}

interface Urteil {
  /** Funde, die keine Ausnahme deckt — die eigentliche Zusage dieses Wächters. */
  readonly unerlaubt: string[];
  /** Ausnahmen, die nicht GENAU EINEN Träger haben — null (Zusage von gestern) oder mehrere. */
  readonly ausnahmeMaengel: string[];
}

/** Alle Funde einer Ausnahme — in der Regel genau einer, sonst ist etwas passiert. */
function traegerVon(funde: readonly Fund[], a: Ausnahme): Fund[] {
  return funde.filter((f) => f.datei === a.datei && f.literal === a.literal);
}

/**
 * Das Urteil. Gedeckt ist der EINE Fund, den eine Ausnahme wirklich meint — nicht jeder Fund mit
 * demselben Text. Bei zwei Trägern deckt die Ausnahme deshalb KEINEN von beiden: welcher der
 * begründete wäre, weiss niemand, und still den ersten zu nehmen hiesse, den zweiten zu verschenken.
 */
function beurteile(funde: readonly Fund[], ausnahmen: readonly Ausnahme[]): Urteil {
  const gedeckt = new Set<string>();
  const ausnahmeMaengel: string[] = [];
  for (const a of ausnahmen) {
    const traeger = traegerVon(funde, a);
    const [einziger] = traeger;
    if (traeger.length === 1 && einziger) {
      gedeckt.add(marke(einziger));
      continue;
    }
    ausnahmeMaengel.push(
      traeger.length === 0
        ? `${a.datei} ${a.literal} — kein Träger mehr: das Literal ist verschwunden, die Ausnahme steht noch. Bitte die Zeile aus AUSNAHMEN entfernen.`
        : `${a.datei} ${a.literal} — ${traeger.length} Träger (${traeger
            .map((t) => `Z${t.zeile}:${t.spalte}`)
            .join(
              ", ",
            )}): eine Ausnahme begründet GENAU EINE Stelle. Ein weiteres Vorkommen desselben Satzes ist eine NEUE Meldungsstelle und gehört in den Katalog.`,
    );
  }
  return {
    unerlaubt: funde.filter((f) => !gedeckt.has(marke(f))).map(zeigeFund),
    ausnahmeMaengel,
  };
}

const ERHEBUNG = DATEIEN.map((d) => erhebeAus(ladeQuelle(d)));
const ALLE_FUNDE = ERHEBUNG.flatMap((e) => e.funde);
const URTEIL = beurteile(ALLE_FUNDE, AUSNAHMEN);

describe("R5 · kein neues deutsches Meldungsliteral an den zwei modulübergreifenden Wächtern", () => {
  it("jede Meldung kommt aus dem Katalog — ausser den zwei namentlich begründeten Stellen", () => {
    expect(
      URTEIL.unerlaubt,
      "Meldungstexte gehören in services/auth/src/meldungen.ts und werden über " +
        "meldung(schluessel, sprache(request)) aufgelöst. Gibt es für einen Satz keinen Schlüssel, " +
        "gehört die STELLE mit Grund in die Liste AUSNAHMEN dieser Datei — eine bestehende Ausnahme " +
        "deckt den zweiten Träger desselben Satzes NICHT mit ab.",
    ).toEqual([]);
  });

  it("jede Ausnahme deckt genau eine Stelle — nicht null, nicht zwei", () => {
    expect(URTEIL.ausnahmeMaengel).toEqual([]);
  });

  it.each(AUSNAHMEN)("die Ausnahme $datei $literal hat genau einen Träger", (ausnahme) => {
    const traeger = traegerVon(ALLE_FUNDE, ausnahme);
    expect(
      traeger.map(zeigeFund),
      `Die Ausnahme für ${ausnahme.literal} muss auf GENAU EINE Stelle zeigen: bei 0 ist sie eine Zusage von gestern und gehört aus der Liste, bei 2+ ist eine Meldungsstelle dazugekommen.`,
    ).toHaveLength(1);
  });

  it("jede Ausnahme trägt eine Begründung, keine leere Zeile", () => {
    for (const a of AUSNAHMEN) {
      expect(a.grund.length, a.literal).toBeGreaterThan(40);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// R6 · DIE GRÖSSENPINS (Lehre JOB 3489)
// ------------------------------------------------------------------------------------------------
// „Jede Testmenge, die aus einer Laufzeitquelle abgeleitet wird, braucht einen eigenen `it`
// AUSSERHALB von `it.each`, der ihre erwartete Größe festnagelt — sonst kann die ganze Prüfmenge
// lautlos auf null schrumpfen." Ohne diese Fälle wäre ein Wächter, der aus Versehen keine Datei
// mehr liest, ein GRÜNER Wächter.
describe("R6 · die Prüfmenge kann nicht lautlos auf null schrumpfen", () => {
  it("genau zwei Dateien werden geprüft, und beide sind wirklich gelesen worden", () => {
    expect(DATEIEN).toHaveLength(2);
    expect(ERHEBUNG).toHaveLength(2);
    for (const e of ERHEBUNG) {
      expect(e.leseFehler, e.datei).toEqual([]);
      // Eine leere oder unlesbare Datei hätte keine Anweisungen — und fände nie etwas.
      expect(e.anweisungen, e.datei).toBeGreaterThan(3);
    }
  });

  it("die Ausnahmeliste hat genau zwei Einträge", () => {
    expect(AUSNAHMEN).toHaveLength(2);
  });

  it("der Sammler findet überhaupt etwas — je Datei mindestens einen Fund", () => {
    for (const e of ERHEBUNG) {
      expect(e.funde.length, e.datei).toBeGreaterThan(0);
    }
  });

  // Der Gegenpin zu „mindestens einen": heute gibt es GENAU so viele Funde wie Ausnahmen, jeder
  // Fund ist einer Ausnahme zugeordnet. Wächst diese Zahl, ist eine Meldungsstelle dazugekommen —
  // dann ist entweder R5 rot (kein Katalog) oder die Liste wurde begründet erweitert und diese
  // Zeile zieht mit. Still wachsen kann die Fläche nicht.
  it("heute trägt jede Ausnahme ihren Fund und es gibt keinen weiteren", () => {
    expect(ALLE_FUNDE.map(zeigeFund)).toHaveLength(AUSNAHMEN.length);
  });

  // Kalibrierung des Sammlers an einem EIGENEN Baum: der Wächter soll finden, was er zu finden
  // behauptet, und nicht finden, was er ausdrücklich durchlässt. Ohne diese Probe wäre „0 unerlaubte
  // Funde" auch dann grün, wenn die Erkennung gar nicht funktionierte. Gefahren wird DERSELBE
  // Sammler wie auf den echten Dateien, nicht eine zweite Abschrift davon.
  it("Kalibrierung: erkannt wird das Meldungsliteral, nicht der Kommentar und nicht der Logsatz", () => {
    const probe = [
      '// message: "Nicht angemeldet." — dieser Kommentar zitiert den Satz und ist keine Quelle.',
      "/* Ein Blockkommentar mit demselben Satz: Keine Berechtigung. */",
      'reply.log.error({ err }, "Interner Betriebsfehler maskiert (HTTP 500 INTERNAL).");',
      'reply.code(401).send({ error: "X", message: "Nicht angemeldet." });',
      'reply.code(500).send({ error: "Y", message: meldung("INTERNAL", sprache(request)) });',
      "reply.code(403).send(`Das Recht fehlt hier.`);",
      'const pfad = "../../auth";',
    ].join("\n");
    const funde = erhebeAus(quelleAus("probe.ts", probe)).funde;
    expect(funde.map((f) => f.literal)).toEqual(['"Nicht angemeldet."', "`Das Recht fehlt hier.`"]);
  });
});

// ------------------------------------------------------------------------------------------------
// R7 · DIE MUTATIONEN AUS BENS KORREKTURPFLICHT — DAUERHAFT, NICHT EINMALIG VON HAND
// ------------------------------------------------------------------------------------------------
// BEN hat Runde 1 damit widerlegt, dass er eine ZWEITE Sendestelle mit demselben erlaubten Satz
// eingefügt hat und der Wächter grün blieb. Genau diese Mutation läuft hier ab jetzt bei jedem Tor
// mit — einmal auf einer NEUEN Zeile (BENs Fall) und einmal auf DERSELBEN Quelltextzeile (BENs
// Prüflücke 6: „Die Deduplizierung … darf unterschiedliche AST-Knoten nicht zusammenziehen").
//
// Der echte Quelltext wird dafür NICHT verändert: er wird gelesen, im Speicher um einen Sendezweig
// ergänzt und durch denselben Sammler geschickt. Auf der Platte ändert sich nichts.

/**
 * Der echte Quelltext einer überwachten Datei, um GENAU EINEN zusätzlichen Träger desselben
 * Literals erweitert — wahlweise auf derselben Zeile wie das Original oder auf der nächsten.
 */
function mitZweitemTraeger(
  datei: string,
  literal: string,
  wo: "gleiche-zeile" | "neue-zeile",
): Erhebung {
  const echt = ladeQuelle(datei);
  const stelle = echt.text.indexOf(literal);
  expect(
    stelle,
    `${literal} kommt in ${datei} gar nicht vor — die Probe griffe ins Leere`,
  ).toBeGreaterThan(-1);
  const zeilenende = echt.text.indexOf("\n", stelle);
  expect(zeilenende, `${datei} endet ohne Zeilenumbruch nach ${literal}`).toBeGreaterThan(stelle);
  const zusatz = `reply.code(403).send({ error: "FORBIDDEN", message: ${literal} });`;
  const trenner = wo === "gleiche-zeile" ? " " : "\n      ";
  return erhebeAus(
    quelleAus(
      echt.datei,
      `${echt.text.slice(0, zeilenende)}${trenner}${zusatz}${echt.text.slice(zeilenende)}`,
    ),
  );
}

/** Das Gesamturteil, bei dem die Funde EINER Datei durch eine mutierte Erhebung ersetzt sind. */
function urteilMitErsatz(datei: string, ersatz: readonly Fund[]): Urteil {
  return beurteile([...ALLE_FUNDE.filter((f) => f.datei !== datei), ...ersatz], AUSNAHMEN);
}

/** Die echte Erhebung einer überwachten Datei — fehlt sie, ist die Probe selbst kaputt. */
function erhebungVon(datei: string): Erhebung {
  const e = ERHEBUNG.find((x) => x.datei === datei);
  if (!e) {
    throw new Error(`keine Erhebung für ${datei} — DATEIEN und AUSNAHMEN passen nicht zusammen`);
  }
  return e;
}

describe("R7 · ein zweiter Träger desselben erlaubten Satzes macht den Wächter rot", () => {
  it("Kalibrierung: ohne Mutation ist dieselbe Maschinerie grün", () => {
    for (const e of ERHEBUNG) {
      const urteil = urteilMitErsatz(e.datei, e.funde);
      expect(urteil.unerlaubt, e.datei).toEqual([]);
      expect(urteil.ausnahmeMaengel, e.datei).toEqual([]);
    }
  });

  it.each(AUSNAHMEN)(
    "$datei · ein zweiter $literal auf einer NEUEN Zeile wird rot (BENs Gegenprobe)",
    (ausnahme) => {
      const mutiert = mitZweitemTraeger(ausnahme.datei, ausnahme.literal, "neue-zeile");
      // Die Mutation fügt GENAU EINEN Fund hinzu — sonst misst der Fall etwas anderes als gemeint.
      expect(mutiert.funde).toHaveLength(erhebungVon(ausnahme.datei).funde.length + 1);

      const urteil = urteilMitErsatz(ausnahme.datei, mutiert.funde);
      expect(urteil.ausnahmeMaengel.join(" | ")).toContain("2 Träger");
      // Und keiner der beiden gilt als gedeckt: die Ausnahme begründet nur eine Stelle.
      expect(urteil.unerlaubt.filter((z) => z.includes(ausnahme.literal))).toHaveLength(2);
    },
  );

  it.each(AUSNAHMEN)(
    "$datei · ein zweiter $literal auf DERSELBEN Zeile wird rot (Prüflücke 6: keine Dedup nach Zeile)",
    (ausnahme) => {
      const mutiert = mitZweitemTraeger(ausnahme.datei, ausnahme.literal, "gleiche-zeile");
      const traeger = traegerVon(mutiert.funde, ausnahme);
      // Der Kern: zwei Knoten, dieselbe Zeile, verschiedene Position — und zwei Funde, nicht einer.
      expect(traeger).toHaveLength(2);
      const [erster, zweiter] = traeger;
      expect(erster?.zeile).toBe(zweiter?.zeile);
      expect(erster?.pos).not.toBe(zweiter?.pos);
      // Und die Mutation hat wirklich nur EINEN Fund hinzugefügt, nicht die Zeile zerlegt.
      expect(mutiert.funde).toHaveLength(erhebungVon(ausnahme.datei).funde.length + 1);

      const urteil = urteilMitErsatz(ausnahme.datei, mutiert.funde);
      expect(urteil.ausnahmeMaengel.join(" | ")).toContain("2 Träger");
      expect(urteil.unerlaubt.filter((z) => z.includes(ausnahme.literal))).toHaveLength(2);
    },
  );

  it.each(AUSNAHMEN)(
    "$datei · verschwindet $literal ersatzlos, wird die Ausnahme selbst rot",
    (ausnahme) => {
      const echt = ladeQuelle(ausnahme.datei);
      const ohne = erhebeAus(
        quelleAus(echt.datei, echt.text.split(ausnahme.literal).join('meldung("X", "de")')),
      );
      expect(traegerVon(ohne.funde, ausnahme)).toHaveLength(0);
      expect(urteilMitErsatz(ausnahme.datei, ohne.funde).ausnahmeMaengel.join(" | ")).toContain(
        "kein Träger mehr",
      );
    },
  );
});
