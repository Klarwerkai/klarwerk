import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  ausschnitt,
  maskiere,
  orderByBereich,
  richtung,
  sortierstufen,
  stufenkern,
} from "../live-check-postgres-prefilter/abfrage-analyse";

const PG = "services/knowledge-object/src/repo-pg.ts";
const ASK = "services/ask/src/service.ts";
const VERTRAG = "tests/ask/ask-retrieval-topk-scaling-contract.test.ts";
const WURZEL = resolve(__dirname, "../..");
/**
 * JOB 3894 — DER EIGENE PFAD WIRD ABGELEITET, NICHT AUFGESCHRIEBEN. W7 liest den Quelltext DIESER
 * Datei; eine Konstante mit ihrem Namen wäre beim nächsten Verschieben still falsch. `__dirname`
 * kennt die Datei schon (`:18`) — `__filename` ist dieselbe Selbstbezugsform, und `relative` bringt
 * sie in dieselbe wurzelrelative Schreibweise wie `PG`, `ASK` und `VERTRAG`.
 */
const SELBST = relative(WURZEL, __filename);

function lesen(pfad: string): string {
  try {
    return readFileSync(resolve(WURZEL, pfad), "utf8");
  } catch {
    throw new Error(`W1: ${pfad}: Quelle nicht lesbar; gelesener Ausschnitt: <keiner>`);
  }
}

function ast(text: string, pfad: string): ts.SourceFile {
  return ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function genauEins<T>(werte: readonly T[], meldung: string): T {
  const wert = werte[0];
  if (werte.length !== 1 || wert === undefined) {
    throw new Error(`${meldung}; gefunden: ${werte.length}`);
  }
  return wert;
}

/**
 * JOB 3826 — EIN Weg, gelesenen Quelltext wirklich AUSZUFÜHREN: für W1 (Produktionsmethode) wie für
 * W6 (Attrappe des Vertrags). Der Printer entfernt Kommentare, `transpileModule` nimmt die Typen
 * weg, `runInNewContext` führt das Ergebnis mit Zeitlimit in einem eigenen Kontext aus. Ein
 * Kommentar, ein String-Literal oder ein Falltitel kann darin keine Anweisung ersetzen — die Lehre
 * aus JOB 3570 R3 / 3579 R1. Die Vorrichtung steht deshalb genau EINMAL, nicht zweimal.
 */
const PRINTER = ts.createPrinter({ removeComments: true });

function drucke(knoten: ts.Node, datei: ts.SourceFile): string {
  return PRINTER.printNode(ts.EmitHint.Unspecified, knoten, datei);
}

async function fuehreGelesenAus(
  gelesen: readonly string[],
  rumpf: string,
  umgebung: Record<string, unknown>,
): Promise<void> {
  const code = `${gelesen.join("\n")}\n${rumpf}`;
  await runInNewContext(
    ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    umgebung,
    { timeout: 1_000 },
  );
}

/**
 * Nimmt eine Prüfung entgegen, die ROT sein MUSS, und gibt ihre Meldung zum Weiterprüfen zurück.
 * Bleibt sie grün, sagt das dieser Helfer und nicht ein stilles `rejects.toThrow` — genau das war
 * BENs Befund aus Runde 1 („Erwartetes Rot blieb aus: promise resolved undefined").
 */
async function abgewiesen(pruefung: Promise<void>): Promise<string> {
  try {
    await pruefung;
  } catch (fehler) {
    return fehler instanceof Error ? fehler.message : String(fehler);
  }
  throw new Error("die Prüfung blieb GRÜN, obwohl dieser Fall sie rot machen muss");
}

/**
 * `<pfad>:<zeile>` der ersten ROHZEILE, die `fragment` trägt. Das ist der Ort, den eine Meldung
 * nennen muss: eine abstrahierte Rangfolge allein schickt den Nächsten auf die Suche (BEN, Pflicht 2).
 */
function zeileVon(text: string, pfad: string, fragment: string): string {
  const nr = text.split("\n").findIndex((z) => z.includes(fragment));
  if (nr < 0) {
    throw new Error(`${pfad}: keine Zeile trägt „${fragment}“`);
  }
  return `${pfad}:${nr + 1}`;
}

/**
 * W1 liest über den TS-AST ausschließlich PgKoRepo.findCandidates samt seinen beiden
 * Suchfeld-Konstanten. Der Printer entfernt Kommentare; Literale/Falltitel können keine Methode
 * ersetzen. Die unveränderte Methode baut im isolierten Kontext ihre SQL-Anweisung; der Pool
 * zeichnet nur auf, er sortiert keine Ersatzdaten. Auch eine Quelltext-Arbeitskopie geht durch
 * genau diesen Leser (kein Importcache, kein vom verstellten Quelltext unabhängiger Stellvertreter).
 *
 * Die SQL-Zerlegung wird aus JOB 3583 wiederverwendet. Hier KEINE erneuten Zusicherungen zu
 * Termanzahl, ODER-Armen, Parametern oder LIMIT: wir benennen die gelesenen Stufen und vergleichen
 * sie mit der Prosa. Die SQL-Richtigkeit und echte Datenbank bleiben Aufgabe von JOB 3583.
 */
interface Gelesen {
  /** Die Sortierstufen in der Reihenfolge des `ORDER BY`. */
  readonly kette: readonly string[];
  /** Der `ORDER BY` der WIRKLICH abgesetzten Anweisung, wörtlich — der Beleg in jeder Meldung. */
  readonly orderBy: string;
}

async function pgRangfolge(text: string, pfad = PG): Promise<Gelesen> {
  const datei = ast(text, pfad);
  const fehler = (grund: string): Error =>
    new Error(`W1: ${pfad}: ${grund}; gelesener Ausschnitt: ${text.slice(0, 240)}`);
  const klasse = datei.statements.find(
    (n): n is ts.ClassDeclaration => ts.isClassDeclaration(n) && n.name?.text === "PgKoRepo",
  );
  const methode = klasse?.members.find(
    (n): n is ts.MethodDeclaration =>
      ts.isMethodDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === "findCandidates",
  );
  if (!methode?.body) throw fehler("PgKoRepo.findCandidates nicht gefunden");
  const konstanten = ["KO_CANDIDATE_SEARCH", "KO_CANDIDATE_SEARCH_EXPRESSIONS"].map((name) => {
    const deklaration = datei.statements
      .filter(ts.isVariableStatement)
      .flatMap((n) => [...n.declarationList.declarations])
      .find((n) => ts.isIdentifier(n.name) && n.name.text === name);
    if (!deklaration?.initializer) throw fehler(`Suchfeld-Konstante ${name} nicht gefunden`);
    return `const ${name} = ${drucke(deklaration.initializer, datei)};`;
  });
  const abfragen: string[] = [];
  try {
    await fuehreGelesenAus(
      [...konstanten, `class GelesenerAdapter { ${drucke(methode, datei)} }`],
      `const adapter = new GelesenerAdapter();
      adapter.pool = pool;
      adapter.findCandidates({ terms: ["ventil", "pumpe"], limit: 3 });`,
      {
        pool: {
          query(sql: string) {
            abfragen.push(sql);
            return Promise.resolve({ rows: [] });
          },
        },
      },
    );
  } catch (error) {
    throw fehler(`Abfrage nicht lesbar: ${String(error)}; Methode: ${drucke(methode, datei)}`);
  }
  const sql = genauEins(
    abfragen,
    `W1: ${pfad}: Kandidatenabfrage fehlt/mehrdeutig; gelesener Ausschnitt: ${drucke(methode, datei)}`,
  );
  const maske = maskiere(sql);
  const bereiche = sortierstufen(maske);
  const liste = orderByBereich(maske);
  if (bereiche.length === 0 || liste === undefined) {
    throw fehler(`ORDER BY nicht gefunden; SQL: ${sql}`);
  }
  const kette = bereiche.map((bereich) => {
    const kern = ausschnitt(maske, stufenkern(maske, bereich));
    const normal = kern.replace(/\s+/g, " ");
    // CASE muss der Ausdruck selbst sein, nicht ein Wort in einem SQL-Literal/Kommentar.
    const name =
      /^\(CASE WHEN .+ THEN 1 ELSE 0 END(?: \+ CASE WHEN .+ THEN 1 ELSE 0 END)*\)$/i.test(normal)
        ? "Term-Trefferzahl"
        : /^\(status\s*=\s*'validiert'\)$/i.test(normal)
          ? "validiert"
          : /^\(data\s*->>\s*'trust'\)::int$/i.test(normal)
            ? "Trust"
            : undefined;
    if (!name) throw fehler(`unbekannte Sortierstufe ${kern}; SQL: ${sql}`);
    return `${name} ${richtung(maske, bereich) === "desc" ? "↓" : "↑"}`;
  });
  return { kette, orderBy: `ORDER BY ${ausschnitt(maske, liste)}`.replace(/\s+/g, " ") };
}

/**
 * JOB 3617 R2 — DIE EINE MELDUNG, DIE JEDE ROTE PRÜFUNG TRÄGT (BEN, Korrekturpflicht 2).
 *
 * Runde 1 meldete nur abstrahierte Rangfolgen („gelesene Kette … → …"). Wer das liest, weiss
 * weder, WELCHE Zeile welcher Datei die Behauptung aufstellt, noch WAS die Abfrage wirklich sagt,
 * und muss beides suchen. Hier steht deshalb immer dreierlei: der ORT der Behauptung mit Zeile,
 * die BEHAUPTUNG selbst und der WÖRTLICHE `ORDER BY` samt der daraus gelesenen Kette.
 */
function diagnose(
  ort: string,
  stelle: string,
  behauptet: readonly string[],
  gelesen: Gelesen,
): string {
  return `${ort}: ${stelle} behauptet (${behauptet.join(" → ")}); ${PG} liest \`${gelesen.orderBy}\` = ${gelesen.kette.join(" → ")}`;
}

/** Nur die echten führenden Kommentare AM ÜBERGEBENEN KNOTEN, keine Dateivolltextsuche. */
function kommentarAm(text: string, knoten: ts.Node): string {
  const ranges = ts.getLeadingCommentRanges(text, knoten.getFullStart()) ?? [];
  return ranges
    .map((r) => text.slice(r.pos, r.end))
    .join("\n")
    .replace(/^\s*(?:\/\/ ?|\/\*\*?|\*\/|\* ?)/gm, "")
    .trim();
}

/** Nur die echten führenden Kommentare am benannten AST-Knoten, keine Dateivolltextsuche. */
function kommentar(text: string, pfad: string, name: string): string {
  const datei = ast(text, pfad);
  const knoten = genauEins(
    datei.statements.filter(
      (n) =>
        (ts.isFunctionDeclaration(n) && n.name?.text === name) ||
        (ts.isVariableStatement(n) &&
          n.declarationList.declarations.some(
            (d) => ts.isIdentifier(d.name) && d.name.text === name,
          )),
    ),
    `${pfad}: Kommentaranker ${name} fehlt/mehrdeutig`,
  );
  return kommentarAm(text, knoten);
}

/** Trägt dieser Knoten irgendwo ein AUSFÜHRBARES Glied namens `findCandidates`? */
function baueFindCandidates(knoten: ts.Node): boolean {
  let gefunden = false;
  const gehe = (k: ts.Node): void => {
    if (gefunden) {
      return;
    }
    if (
      (ts.isMethodDeclaration(k) || ts.isPropertyAssignment(k)) &&
      ts.isIdentifier(k.name) &&
      k.name.text === "findCandidates"
    ) {
      gefunden = true;
      return;
    }
    ts.forEachChild(k, gehe);
  };
  ts.forEachChild(knoten, gehe);
  return gefunden;
}

/**
 * JOB 3617 — DIE ATTRAPPE WIRD STRUKTURELL GESUCHT, NICHT BEIM NAMEN GERUFEN.
 *
 * Gesucht ist die einzige Funktionsdeklaration des Vertrags, die eine Kandidatenquelle BAUT: ein
 * ausführbares `findCandidates`-Glied im Rumpf (AST, kein Text — ein Kommentar oder ein Literal
 * „findCandidates" macht keine Quelle). Erst dadurch darf der Wächter über den NAMEN dieser Funktion
 * urteilen, statt ihn vorauszusetzen; eine Umbenennung macht ihn nicht blind, sondern lässt ihn
 * weiter dieselbe Stelle prüfen. Findet er sie nicht oder mehrfach, ist er rot mit Grund.
 */
function attrappe(text: string, pfad = VERTRAG): ts.FunctionDeclaration {
  const datei = ast(text, pfad);
  return genauEins(
    datei.statements.filter(
      (n): n is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(n) && n.body !== undefined && baueFindCandidates(n.body),
    ),
    `W5: ${pfad}: Attrappe (Funktion mit ausführbarem findCandidates) fehlt/mehrdeutig`,
  );
}

function absatz(text: string, anfang: string, ort: string): string {
  return genauEins(
    text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.startsWith(anfang)),
    `${ort}: Absatz „${anfang}“ fehlt/mehrdeutig`,
  );
}

interface Behauptung {
  /** Die behauptete Rangfolge, Stufe für Stufe. */
  readonly kette: string[];
  /** Die Zeile, so wie sie in der Quelle steht — damit die Meldung ihren Ort nennen kann. */
  readonly marke: string;
}

function behaupteteRangfolge(prosa: string, ort: string): Behauptung {
  const zeile = genauEins(
    prosa.split("\n").filter((z) => /^\s*· PgKoRepo(?:\.findCandidates)? sortiert /.test(z)),
    `${ort}: PgKoRepo-Aufzählung fehlt/mehrdeutig`,
  );
  const marke = zeile.trim();
  const rang = /sortiert \(([^)]+)\)/.exec(zeile)?.[1];
  if (rang) return { kette: rang.split(",").map((s) => s.trim()), marke };
  // Auch den historischen SQL-Wortlaut verstehen: dessen Stufen widersprechen der heutigen
  // Abfrage inhaltlich. Nicht schon die andere Schreibweise soll den Vergleich abbrechen.
  const sql = /`(ORDER BY .+ LIMIT n)`/.exec(zeile)?.[1];
  if (!sql) throw new Error(`${ort}: keine Rangfolge gelesen: ${zeile}`);
  const maske = maskiere(sql);
  const kette = sortierstufen(maske).map((bereich) => {
    const kern = ausschnitt(maske, stufenkern(maske, bereich));
    const name = kern === "(status='validiert')" ? "validiert" : kern === "trust" ? "Trust" : kern;
    return `${name} ${richtung(maske, bereich) === "desc" ? "↓" : "↑"}`;
  });
  return { kette, marke };
}

// ================================================================================================
// JOB 3617 R2 · DER WIDERSPRUCH NEBEN DER RICHTIGEN LISTE (BEN, Korrekturpflicht 1).
// ================================================================================================
//
// BENS BEFUND: eine richtige Rangfolgenliste UND daneben „PgKoRepo rankt OHNE Relevanzmass." kam
// durch, weil nur der Klammerinhalt gelesen wurde. Eine Erklärung, die im selben Kommentar die
// Kette nennt und ihr Fehlen behauptet, ist nicht halb richtig — sie ist unbrauchbar.
//
// DIE REGEL, und warum sie am SQL hängt und nicht an einer Wortliste: Trägt der gelesene `ORDER BY`
// eine RELEVANZSTUFE, darf kein Satz der bewachten Erklärung dem Produktionsadapter deren Fehlen
// zuschreiben. Fällt die Stufe weg, ist derselbe Satz wahr und bleibt unbeanstandet (eigener Fall).
//
// WER ÜBER FRÜHER REDET, SAGT ES: Die alte Rangfolge darf benannt werden — als Vergangenheit. Ohne
// Marke („damals", „früher", „vor JOB 3583" …) ist ein Satz eine Aussage über HEUTE. Das ist die
// bewusste Grenze dieser Prüfung: sie liest Text, urteilt aber nur über Sätze, die den
// Produktionsadapter NAMENTLICH nennen — über die Attrappe („KEIN Relevanzmaß") urteilt sie nie.
const PRODUKTIONSADAPTER = /PgKoRepo|Produktionsadapter/;
const VERNEINUNG: readonly RegExp[] = [
  /OHNE\s+(?:jedes\s+)?Relevanz/i,
  /KEIN(?:E|EN|ER)?\s+Relevanz/i,
  /(?:nur|ausschließlich|ausschliesslich|bloß|bloss)\s+nach\s+\(?\s*(?:validiert|status|trust)/i,
  /(?:rankt|sortiert|deckelt|ordnet)\s+ohne\b/i,
  /ohne\s+(?:jede\s+)?(?:Term-?)?Trefferzahl/i,
];
const VERGANGENHEIT = /damals|früher|vor JOB 3583|bis JOB 3583|historisch|seinerzeit|bisher/i;

function keinWiderspruch(
  prosa: string,
  quelle: string,
  pfad: string,
  ort: string,
  gelesen: Gelesen,
): void {
  if (!gelesen.kette.some((stufe) => stufe.startsWith("Term-Trefferzahl"))) {
    return; // Ohne Relevanzstufe im SQL ist die Verneinung wahr — dann urteilt allein die Rangfolge.
  }
  for (const roh of prosa.split(/(?<=\.)\s/)) {
    const satz = roh.replace(/\s+/g, " ").trim();
    if (!PRODUKTIONSADAPTER.test(satz) || VERGANGENHEIT.test(satz)) {
      continue;
    }
    const treffer = VERNEINUNG.find((muster) => muster.test(satz));
    if (treffer === undefined) {
      continue;
    }
    // Der Ort wird über das LÄNGSTE Stück gesucht, das in der Quelle auf EINER Zeile steht: ein
    // über zwei Kommentarzeilen umbrochener Satz wäre sonst als Ganzes nirgends zu finden.
    const anker = [...roh.split("\n")].map((z) => z.trim()).sort((a, b) => b.length - a.length)[0];
    throw new Error(
      `${ort} Widerspruch: ${zeileVon(quelle, pfad, anker ?? satz)} sagt „${satz}" — die Verneinung „${treffer.exec(satz)?.[0]}" steht ohne Vergangenheitsmarke (damals/früher/vor JOB 3583); ${PG} liest \`${gelesen.orderBy}\` = ${gelesen.kette.join(" → ")}`,
    );
  }
}

async function pruefeService(text: string, pg: string): Promise<void> {
  const gelesen = await pgRangfolge(pg);
  const prosa = kommentar(text, ASK, "ASK_PREFILTER_TERM_LIMIT");
  const behauptung = behaupteteRangfolge(prosa, "W2");
  expect(
    behauptung.kette,
    diagnose("W2", zeileVon(text, ASK, behauptung.marke), behauptung.kette, gelesen),
  ).toEqual(gelesen.kette);
  keinWiderspruch(prosa, text, ASK, "W2", gelesen);
}

function schwaechereQuelle(prosa: string, ort: string): void {
  // Ein vollständiger, bejahter Satz im ZUGEHÖRIGEN Absatz ist der Vertrag. Ein Stichwort in
  // einem anderen Kommentar, Literal oder Falltitel darf keine fehlende Erklärung ersetzen.
  expect(
    prosa,
    `${ort}: Hinweis auf bewusst schwächere Quelle fehlt oder widerspricht sich`,
  ).toMatch(
    /^Der Doppelgänger bildet die Rangfolge des Produktionsadapters VOR JOB 3583 nach — bewusst die schwächere Quelle als die Produktion, gegen die dieser Vertrag härtet\.(?: ODER-Match, dann validiert\/Trust, dann hartes Limit\.)?$/,
  );
}

/**
 * JOB 3617 — KEINE STELLE DER DATEI DARF DEN NACHBAU SCHWÄCHER BEHAUPTEN ALS DIE BEWACHTEN ZWEI.
 *
 * Diese Prüfung ist bewusst eine TEXTPRÜFUNG, und das widerspricht der Lehre aus JOB 3570 R4 nicht:
 * sie ist NEGATIV. Text kann sie nur VERLETZEN, nie erfüllen — jedes Wort „Produktionsadapter" in
 * dieser Datei muss die vollständige, ehrliche Fortsetzung tragen. Ein Kommentar, ein Literal oder
 * ein Falltitel kann damit keine fehlende Erklärung ersetzen, aber auch nicht unbemerkt eine
 * zweite, schwächere aufmachen. Die zwei TRAGENDEN Stellen bleiben strukturell gebunden (unten).
 */
function keineWeitereBehauptung(text: string, ort: string): void {
  const flach = text.replace(/^\s*(?:\/\/ ?|\/\*\*?|\*\/|\* ?)/gm, "").replace(/\s+/g, " ");
  // Das `\b` ist tragend: ohne es nimmt der Regexmotor beim Zurückgehen die Form OHNE „s", prüft
  // die Fortsetzung ab „s VOR JOB …" — und erklärt so ausgerechnet die ehrliche Stelle für offen.
  const offen = [
    ...flach.matchAll(
      /Produktionsadapters?\b(?! VOR JOB 3583 nach — bewusst die schwächere Quelle als die Produktion, gegen die dieser Vertrag härtet\.)/g,
    ),
  ].map((m) => flach.slice(m.index, (m.index ?? 0) + 140));
  expect(offen, `${ort}: Stelle über den Produktionsadapter ohne die ehrliche Fortsetzung`).toEqual(
    [],
  );
}

async function pruefeVertrag(text: string, pg: string): Promise<void> {
  const kopf = kommentar(text, VERTRAG, "FRAGE");
  const befund = absatz(kopf, "HEUTE:", "W3 Befund");
  const gelesen = await pgRangfolge(pg);
  const behauptung = behaupteteRangfolge(kopf, "W3 Befund");
  // Die Aussage muss im HEUTE-Absatz stehen; eine Liste irgendwo sonst im Kopf zählt nicht.
  expect(befund, `W3 Befund: „${behauptung.marke}" steht ausserhalb des HEUTE-Absatzes`).toContain(
    behauptung.marke,
  );
  expect(
    behauptung.kette,
    diagnose("W3 Befund", zeileVon(text, VERTRAG, behauptung.marke), behauptung.kette, gelesen),
  ).toEqual(gelesen.kette);
  const mock = attrappe(text);
  const doc = kommentarAm(text, mock);
  keinWiderspruch(kopf, text, VERTRAG, "W3", gelesen);
  keinWiderspruch(doc, text, VERTRAG, "W3", gelesen);
  const hinweis = befund.slice(befund.indexOf("Der Doppelgänger"));
  schwaechereQuelle(hinweis, "W3 Befund");
  schwaechereQuelle(absatz(doc, "Der Doppelgänger", "W3 Docstring"), "W3 Docstring");
  keineWeitereBehauptung(text, "W3 Fundstellen");
  // W5 steht ZULETZT: die Gegenproben oben sollen an ihrem eigenen Grund scheitern, nicht an diesem.
  expect(
    mock.name?.text ?? "",
    `W5: ${VERTRAG}: die Attrappe benennt sich nach dem Produktionsadapter, bildet ihn aber bewusst nicht nach`,
  ).not.toMatch(/pg|postgres|produktion/i);
}

const pg = lesen(PG);
const service = lesen(ASK);
const vertrag = lesen(VERTRAG);
/** Der eigene Quelltext, über denselben Leser wie jede fremde Quelle — W7 urteilt über ihn. */
const selbst = lesen(SELBST);

function ersetzen(text: string, alt: string, neu: string): string {
  if (!text.includes(alt)) throw new Error(`Kalibrierung erreicht Quelle nicht: ${alt}`);
  return text.replace(alt, neu);
}

const OHNE_TREFFER = () => ersetzen(pg, "ORDER BY (${trefferzahl}) DESC,", "ORDER BY");
const HINWEIS = "VOR JOB 3583 nach — bewusst die schwächere Quelle als die Produktion";
// JOB 3617: ZWEI Stellen, nicht mehr drei. Die dritte war ein WÖRTLICHES Duplikat der zweiten im
// selben Kommentarblock und ist ENTFERNT, nicht ungeprüft gelassen — die Zahl hier ist die
// Kalibrierung auf die zwei strukturell gebundenen Anker (Befundabsatz, Docstring der Attrappe).
// Dass keine dritte, schwächere Stelle nachwachsen kann, deckt `keineWeitereBehauptung`.
const ANKER = 2;
// JOB 3617 Gegenprobe (a): der widerlegte Wortlaut von vor JOB 3583, wörtlich zurückgestellt.
const ALTER_SATZ_SERVICE =
  "//   · PgKoRepo sortiert `ORDER BY (status='validiert') DESC, trust DESC LIMIT n` OHNE Relevanzmaß.";
const ALTER_SATZ_VERTRAG =
  "//   · PgKoRepo.findCandidates sortiert `ORDER BY (status='validiert') DESC, trust DESC LIMIT n` — OHNE Relevanzmaß.";
const FREMDTEXT = [
  ["Kommentar", (s: string) => `\n// ${s}\n`],
  ["Stringliteral", (s: string) => `\nconst scheinbeleg = ${JSON.stringify(s)};\n`],
  ["Falltitel", (s: string) => `\nit(${JSON.stringify(s)}, () => {});\n`],
] as const;

// ================================================================================================
// JOB 3826 · W6 — DER WÄCHTER MISST DEN DOPPELGÄNGER, NICHT NUR SEINEN NAMEN.
// ================================================================================================
//
// WARUM ES DIESEN FALL GIBT. BENs Messung in `archiv/3601/runde-1/ben.md:24`, wörtlich: „Ich habe
// den Doppelgänger in `ask-retrieval-topk-scaling-contract.test.ts:70-73` auf die heutige
// Pg-Rangfolge nachgezogen (Trefferzahl zuerst) — also genau die nach §10 verbotene Änderung, die
// den Härtungsvertrag zerstört. Ergebnis: `Tests 22 passed (22)`, beide Dateien grün. W3 prüft nur
// die Prosa; nichts prüft, dass der Doppelgänger tatsächlich noch OHNE Relevanzmaß sortiert. Die
// Prosa würde dann lügen, und kein Lauf würde rot."
//
// W1–W5 urteilen über Quelltext, Prosa und NAMEN; keiner führt die Attrappe je aus. W6 führt sie
// aus — über denselben Weg wie W1 (drucken ohne Kommentare, transpilieren, `runInNewContext`).
//
// WAS W6 ZUSICHERT: Die Attrappe ist RELEVANZBLIND — sie liefert den Treffer, der ALLE Fragebegriffe
// abdeckt, innerhalb ihres Limits NICHT, und sie schneidet wirklich auf das Limit.
//
// DER GESTELLTE BESTAND ALS PIN (gemessen, nicht geschätzt): drei Störer `stoerer-0..2` treffen NUR
// „spz42", sind `validiert`, Trust 99; ein Ziel `ziel-deckt-alle-terme` trifft alle DREI Begriffe,
// ist `validiert`, hat aber Trust 60; `limit` = 3. Relevanzblind sortiert liefert die Attrappe genau
// (stoerer-0 → stoerer-1 → stoerer-2). Zieht jemand die Trefferzahl nach vorn, liefert sie
// (ziel-deckt-alle-terme → stoerer-0 → stoerer-1) — und W6 ist rot, mit Datei, Zeile und beiden
// Reihenfolgen.
//
// JOB 3826 R2 (BEN, Korrekturpflichten 1 und 2): JEDE rote W6-Meldung wird aus dem WIRKLICH
// gelieferten Ergebnis GEBAUT, nie vorausgesetzt. Runde 1 schrieb in jede Rangfolge-Meldung
// „sortiert RELEVANZBEWUSST und liefert „ziel-deckt-alle-terme"" — BEN hat das mit einer umgedrehten
// Störerreihenfolge widerlegt (geliefert: stoerer-2 → stoerer-1 → stoerer-0, das Ziel gar nicht
// dabei). Und auch die Limit-Meldung nennt beide ID-Reihenfolgen: eine Anzahl ersetzt keine IDs.
//
// WAS W6 AUSDRÜCKLICH NICHT ZUSICHERT: ob der Ask-Pfad im PRODUKT sich unter einer relevanzblinden
// Quelle richtig verhält — das misst der Vertrag selbst (`tests/ask/…-contract.test.ts:149`). Auch
// die `InMemoryKoRepo`-Zeile `services/ask/src/service.ts:60` bleibt ungelesen (die zweite, kleinere
// Lücke aus `ben.md:24`); sie gehört in eine eigene Zeile, sobald `repo.ts` frei ist.
const W6_TERME = ["spz42", "wartung", "druckspeicher"] as const;
const W6_STOERER = ["stoerer-0", "stoerer-1", "stoerer-2"] as const;
const W6_ZIEL = "ziel-deckt-alle-terme";
const W6_LIMIT = W6_STOERER.length;

function w6Bestand(): readonly Record<string, unknown>[] {
  return [
    ...W6_STOERER.map((id, i) => ({
      id,
      title: `Sammelhinweis ${i}`,
      statement: `Allgemeiner Hinweis zu ${W6_TERME[0]} ohne weiteren Zusammenhang.`,
      status: "validiert",
      trust: 99,
    })),
    {
      id: W6_ZIEL,
      title: `Spezialzylinder ${W6_TERME[0]} warten`,
      statement: `Vor der ${W6_TERME[1]} den ${W6_TERME[2]} entleeren.`,
      status: "validiert",
      trust: 60,
    },
  ];
}

interface Doppelgaenger {
  /** Die IDs in der Reihenfolge, in der die ausgeführte Attrappe sie WIRKLICH geliefert hat. */
  readonly geliefert: readonly string[];
  /** Ihr Name, so wie er im Vertrag steht — nie vorausgesetzt, immer gelesen. */
  readonly name: string;
  /** `<pfad>:<zeile>` ihrer Deklaration: der Ort, den jede rote Meldung nennt (BEN, Pflicht 2). */
  readonly ort: string;
}

// ================================================================================================
// JOB 3850 · DIE FRIST DES ASYNCHRONEN ZWEIGS — DAS vm-ZEITLIMIT GREIFT NUR SYNCHRON.
// ================================================================================================
//
// GEMESSEN, NICHT ANGENOMMEN: `runInNewContext(..., { timeout: 1_000 })` (`:69`) bricht
// ausschliesslich eine synchron laufende Anweisung ab. Liefert die Attrappe ein Promise, das nie
// auflöst, greift es überhaupt nicht — gewartet wird danach im TESTPROZESS, und dort gab es kein
// Zeitlimit. Der Fall „ASYNCHRON hängende Attrappe" unten lief am Stand VOR dieser Frist 60007 ms
// und endete mit Vitests eigenem `Test timed out in 60000ms.`: ohne Datei, ohne Zeile, ohne
// gelesenen Ausschnitt. Genau das schliesst der Kopf von `fuehreAttrappeAus` aus.
//
// UND ZWAR AN ZWEI STELLEN, was erst die Messung zeigte. Die letzte Anweisung des Rumpfs ist die
// ZUWEISUNG `aufzeichnung.lauf = …`; der Wert eines Zuweisungsausdrucks ist der zugewiesene Wert,
// und damit gibt `runInNewContext` genau dieses Promise zurück (nachgemessen: der Rückgabewert ist
// `=== aufzeichnung.lauf`). `fuehreGelesenAus` wartet es also bereits selbst ab — eine Frist allein
// auf dem späteren `await aufzeichnung.lauf` wurde nie erreicht und liess den Fall weiter 60 s
// hängen (auch das gemessen). Beide Wartestellen bekommen deshalb dieselbe Frist. Die zweite ist
// kein Beiwerk: verschöbe jemand die Zuweisung aus der letzten Zeile, wäre sie die einzige.
//
// JOB 3868 — JEDE DER BEIDEN WARTESTELLEN TRÄGT JETZT IHREN EIGENEN FALL. Bis hierher war die
// zweite eine geschriebene Zusage ohne Messung (BEN, `archiv/3850/runde-1/ben.md:33`). GEMESSEN am
// 13.09.2026 (R1 der Rückgabe zu JOB 3868, Runde 2): mit entfernter Frist an `await aufzeichnung.lauf`
// ist von den 51 Fällen dieser Datei GENAU EINER rot — der mit neutralem Abschluss, und der lief
// dann 60014 ms in Vitests eigenes Zeitlimit. Die übrigen 50 bleiben grün: kein Bestandsfall
// erreicht diese Stelle. Hergestellt wird sie über den Schalter `neutralerAbschluss` von
// `fuehreAttrappeAus`: eine abschliessende Anweisung des Rumpfs, deren Wert NICHT das
// Kandidaten-Promise ist, lässt `fuehreGelesenAus` sofort zurückkehren. Wer kalibriert was:
//   · ERSTE Wartestelle (um `fuehreGelesenAus`): „eine ASYNCHRON hängende Attrappe …" und
//     „eine VERSPÄTET antwortende Attrappe …" — beide bleiben grün, wenn die zweite Frist fällt.
//   · ZWEITE Wartestelle (um `await aufzeichnung.lauf`): „mit NEUTRALEM Abschluss …" — der einzige
//     Fall, den das Entfernen dieser Frist rot macht (gemessen, R1 der Rückgabe zu JOB 3868).
// OFFEN BLEIBT: WELCHE Wartestelle greift, entscheidet weiterhin die Form des VM-Rumpfs und nicht
// eine Zusicherung im Läufer. Wer den Rumpf umbaut, führt beide Fälle nach.
//
// DIE FRIST IST ECHT LÄNGER als das vm-Zeitlimit (3000 gegen 1000 ms) und wird ERST NACH dessen
// Ablauf scharf: `fuehreGelesenAus(…)` läuft synchron in die VM, bevor `mitFrist` den Zeitgeber
// anlegt. Der synchrone Fall behält seinen eigenen Grund `Script execution timed out`; der
// asynchrone Fall prüft ausdrücklich, dass seine Meldung diesen Wortlaut NICHT trägt.
//
// DASS DER ZEITGEBER DEN VITEST-PROZESS NICHT AM LEBEN HÄLT, STEHT HIER NICHT MEHR ALS ZUSAGE: er
// bekommt `unref` beim Anlegen (`:595`) und `clearTimeout` in jedem Ausgang (`:597`), und dass das
// so BLEIBT, misst W7 am Syntaxbaum dieser Datei (Kopf bei `W7_ZEITGEBER`) — samt dem dort
// eingetragenen Befund der einmal wirklich gefahrenen Handle-Diagnose. Der frühere Beleg war das
// Ausbleiben einer Warnung; das ist kein Messwert (BEN, `archiv/3868/runde-1/ben.md:29`).
const W6_FRIST_MS = 3_000;
const W6_FRIST_GRUND = `die Attrappe kam nicht zurück: ihre Kandidatenabfrage blieb nach ${W6_FRIST_MS} ms offen (asynchrones Hängen — das vm-Zeitlimit greift nur synchron)`;

// WER DIESEN GRUND KALIBRIEREN WILL, VERSTELLT IHN NICHT HIER. Gemessen (R2a der Rückgabe zu JOB
// 3868, Runde 2): mit verstelltem Wortlaut DIESER Konstante bleiben alle 51 Fälle grün — Erzeuger
// und Zusicherung lesen dieselbe Konstante, die Mutation hebt sich auf. Erst die Verstellung auf der
// ERZEUGERSEITE (`new Frist(grund)` in `mitFrist`) trennt: dann sind genau die drei Fälle rot, die
// diesen Grund zusichern, und die beiden anderen Zustandsmodellfälle bleiben grün (R2b, gemessen).

/** Nur diese Ursache; sie darf nicht in „die Attrappe lief nicht" wandern — sie LÄUFT ja noch. */
class Frist extends Error {}

/**
 * Die Vorgabewerte sind die Frist des Wächters; Dauer und Grund sind trotzdem Parameter, weil der
 * Fall der verspäteten Antwort NACH dem Fristfehler ein zweites Mal begrenzt warten muss (und dann
 * mit einem anderen Grund rot ist). Das bleibt EINE Vorrichtung — kein zweiter Zeitgeberweg.
 */
function mitFrist<T>(lauf: Promise<T>, dauer = W6_FRIST_MS, grund = W6_FRIST_GRUND): Promise<T> {
  let uhr: ReturnType<typeof setTimeout> | undefined;
  const frist = new Promise<never>((_, ablehnen) => {
    uhr = setTimeout(() => ablehnen(new Frist(grund)), dauer);
    uhr.unref();
  });
  return Promise.race([lauf, frist]).finally(() => clearTimeout(uhr));
}

// ================================================================================================
// JOB 3868 · DIE VERSPÄTETE ANTWORT — UND WARUM IHR ZEITGEBER IM TESTPROZESS LEBT.
// ================================================================================================
//
// GEMESSEN, NICHT ANGENOMMEN (13.09.2026, eigener Lauf in derselben Vorrichtung): im Kontext von
// `runInNewContext` gibt es KEINE Zeitgeber. `typeof setTimeout`, `typeof setInterval` und
// `typeof queueMicrotask` sind dort allesamt `"undefined"`; `Object.getOwnPropertyNames(globalThis)`
// zählt ausschliesslich Sprachglobale (Object … WebAssembly) und die vom Läufer hereingereichten
// Namen. Eine Attrappe, die ABSICHTLICH zu spät antwortet, kann ihre Verzögerung dort also nicht
// selbst bauen. Sie bekommt sie über die BESTEHENDE `umgebung` — ein zusätzlicher Eintrag
// `verzoegere` —, und ausdrücklich nicht über einen zweiten Ausführungsweg neben `fuehreGelesenAus`.
//
// RUNDE 2 — BENs KORREKTURPFLICHT 1, UND SIE TRAF INS SCHWARZE. Runde 1 hat den Antwortzeitgeber
// unmittelbar nach dem Fristfehler GELÖSCHT. Belegt war damit nur, dass bei Fristablauf noch etwas
// offen war; die verspätete Auflösung trat NIE ein. BENs Gegenprobe: mit entferntem `aufloesen(wert)`
// blieb die ganze Datei grün — ein Fall, der seinen eigenen Gegenstand verhindert. Jetzt WARTET der
// Fall die Antwort ab, liest ihr Ergebnis und die beobachtete Reihenfolge (`w6Hergang`) und räumt
// ERST DANACH ab. Kalibriert ist das mit R4 der Rückgabe: ohne `aufloesen(wert)` ist genau dieser
// Fall rot, und zwar mit `W6_NACHFRIST_GRUND`.
//
// PROZESSHYGIENE: der Zeitgeber läuft im Testprozess. Dass er `unref`'t ist und damit Vitest nicht
// am Leben hält, wird nicht mehr hier behauptet, sondern von W7 aus dem Quelltext gelesen (Kopf bei
// `W7_ZEITGEBER`, mit dem gemessenen Befund der Handle-Diagnose). Was DIESER Fall belegt, sind die zwei Zahlen des
// Laufs: solange der Zeitgeber läuft, zählt ihn `offeneVerzoegerungen()` (1 bei Fristablauf); feuert
// er, trägt er sich selbst aus (0 nach der Antwort), und `raeumeVerzoegerungen()` findet am Ende
// nichts mehr vor.
const W6_VERSPAETUNG_MS = W6_FRIST_MS + 1_000;
/**
 * Obergrenze für das Abwarten der verspäteten Antwort NACH dem Fristfehler. Zu diesem Zeitpunkt
 * fehlen noch rund `W6_VERSPAETUNG_MS - W6_FRIST_MS` ms; die Grenze ist also reichlich bemessen und
 * dient allein dazu, ein AUSBLEIBEN als roten Fall MIT GRUND zu melden statt als Vitest-Zeitlimit.
 */
const W6_NACHFRIST_MS = W6_VERSPAETUNG_MS;
const W6_NACHFRIST_GRUND = `die verspätete Antwort der Attrappe kam auch ${W6_NACHFRIST_MS} ms nach dem Fristfehler nicht an`;
const W6_HERGANG_FRIST = "die Frist hat zugeschlagen";
const W6_HERGANG_ANTWORT = "die Attrappe hat geantwortet";

/**
 * Der beobachtete Hergang dieses Laufs, in der Reihenfolge des Eintreffens. Den Antworteintrag
 * schreibt der Zeitgeber SELBST, im Augenblick seines Feuerns — die Reihenfolge wird also gelesen
 * und nicht vom Fall hergestellt.
 */
const w6Hergang: string[] = [];

interface Verzoegerung {
  readonly ms: number;
  /** Genau das Promise, das die Attrappe zurückgibt: der Fall wartet SEINE Auflösung ab. */
  readonly antwort: Promise<unknown>;
  /** Gesetzt, solange der Zeitgeber läuft; nach dem Feuern (oder Abräumen) `undefined`. */
  uhr: ReturnType<typeof setTimeout> | undefined;
}

const verzoegerungen = new Set<Verzoegerung>();

function verzoegere<T>(wert: T, ms: number): Promise<T> {
  let ausloesen: (wert: T) => void = () => {
    throw new Error("W6: die Verzögerung hat keinen Auflöser bekommen");
  };
  const antwort = new Promise<T>((aufloesen) => {
    ausloesen = aufloesen;
  });
  const eintrag: Verzoegerung = { ms, antwort, uhr: undefined };
  const uhr = setTimeout(() => {
    eintrag.uhr = undefined;
    w6Hergang.push(W6_HERGANG_ANTWORT);
    ausloesen(wert);
  }, ms);
  uhr.unref();
  eintrag.uhr = uhr;
  verzoegerungen.add(eintrag);
  return antwort;
}

/** Wie viele Verzögerungen JETZT offen sind: ihr Zeitgeber läuft, ihre Antwort steht aus. */
function offeneVerzoegerungen(): number {
  let offen = 0;
  for (const eintrag of verzoegerungen) {
    if (eintrag.uhr !== undefined) {
      offen += 1;
    }
  }
  return offen;
}

/** Die zuletzt angelegte Verzögerung; ohne sie kann kein Fall eine verspätete Antwort abwarten. */
function letzteVerzoegerung(): Verzoegerung {
  const letzte = [...verzoegerungen].at(-1);
  if (letzte === undefined) {
    throw new Error("W6: die Attrappe hat keine Verzögerung angelegt");
  }
  return letzte;
}

/**
 * Setzt die Buchführung zurück (auch `w6Hergang`) und gibt zurück, wie viele Zeitgeber dabei NOCH
 * LIEFEN — die Zahl ist der Beleg, nicht ein Nebeneffekt.
 */
function raeumeVerzoegerungen(): number {
  const offen = offeneVerzoegerungen();
  for (const eintrag of verzoegerungen) {
    if (eintrag.uhr !== undefined) {
      clearTimeout(eintrag.uhr);
      eintrag.uhr = undefined;
    }
  }
  verzoegerungen.clear();
  w6Hergang.length = 0;
  return offen;
}

// ================================================================================================
// JOB 3894 · W7 — DIE PROZESSHYGIENE DIESER DATEI WIRD GELESEN, NICHT ZUGESAGT.
// ================================================================================================
//
// WARUM ES DIESEN FALL GIBT. Bis hierher stand die Zusage „der Zeitgeber hält den Vitest-Prozess
// nicht am Leben" ZWEIMAL als Prosa im Kopf dieser Datei, und ihr Beleg war das AUSBLEIBEN einer
// Warnung — BEN hat das in `archiv/3868/runde-1/ben.md:29` als das benannt, was es ist: gegengesucht
// wurde auf `hanging`, `open handle`, `prevents`, `close timed out` → 0 Treffer. Ein nicht
// erschienener Warntext ist kein Messwert. Nahm jemand ein `unref()` heraus, blieben alle 51 Fälle
// grün, und auffallen wäre es erst an einem hängenden Torlauf — der teuersten Stelle der Maschine
// (Median 1157 s, `gespraech/pruefstau-20260913/tor-main-zeiten.json`). W7 kostet Millisekunden.
//
// AM SYNTAXBAUM, NICHT AM TEXT. Gesucht wird jeder AUSFÜHRBARE `setTimeout`/`setInterval`-Aufruf
// dieser Datei — auch als `globalThis.setTimeout(…)` —, und zwar mit seiner BINDUNG: der
// zurückgegebene Zeitgeber muss VOR SEINER ERSTEN VERWENDUNG `unref()` bekommen. Eine
// Zeichenkettensuche nach `.unref()` wüsste nichts über diese Zuordnung (ein `unref` an der falschen
// Variablen wäre grün), kippte beim ersten Umbenennen und zählte jeden Kommentar mit. Dass der Text
// `setTimeout(` in dieser Datei öfter dasteht, als es Anlegestellen gibt, misst die Kalibrierung
// „blinder Text" ausdrücklich mit.
//
// GLEICHER NAME IST NOCH KEINE GLEICHE BINDUNG — RUNDE 2 WAR GENAU HIER FALSCH GRÜN, und das ist
// gemessen, nicht eingeräumt. BEN hat in Runde 2 (`ben.md`, „Entscheidende Gegenprobe", Cloud-Lauf
// `a91faad9fdd675bbbf26e27c`) die echte `unref`-Zeile in `verzoegere` durch
// `{ const uhr = { unref() {} }; uhr.unref(); }` ersetzt: der Zeitgeber bekam KEIN `unref()` mehr,
// ein gleichnamiges fremdes Objekt in einem INNEREN Block bekam eines — und W7 meldete
// `0 Beanstandungen`, alle 57 Fälle grün. Der Grund war, dass die Suche nach der ersten Verwendung
// Bezeichner nur nach ihrem TEXT verglich. Seitdem liest W7 den GÜLTIGKEITSBEREICH: zuerst wird der
// Bereich bestimmt, in dem der Name wirklich DEKLARIERT ist (`bindungsbereich` — bei
// `const uhr = setTimeout(…)` der Block der Deklaration, bei `uhr = setTimeout(…)` der Rumpf mit dem
// `let uhr`, nicht der Promise-Rückruf); dann wird nur in diesem Bereich gesucht, und jeder INNERE
// Bereich, der denselben Namen neu bindet (Deklaration, Parameter, Rückrufparameter), wird NICHT
// betreten, sondern als Überschattung in der Beanstandung genannt. Beide Formen von BENs Gegenprobe
// stehen jetzt als eigene Fälle da, ebenso die Gegenrichtung: ein korrekt UMBENANNTER Zeitgeber
// (`wecker` statt `uhr`) muss grün bleiben, sonst wäre der Wächter nur auf den Namen `uhr` geeicht.
//
// RUNDE 3 WAR AN DERSELBEN STELLE NOCH EINMAL FALSCH GRÜN, UND ZWAR AUS EINEM ANNAHMEFEHLER — das
// ist die eigentliche Lehre dieses Jobs und steht deshalb hier, nicht nur im Protokoll. Die
// Bindungsauflösung las `var` wie eine Blockbindung und begründete das damit, eine strengere Lesart
// als die der Sprache könne „höchstens falsch ROT" sein. Sie kann es nicht. BEN hat gemessen
// (Runde 3, Cloud-Lauf `c8feae2b4303d5505fdcb997`): mit
// `(() => { if (true) { var uhr = { unref() {} }; } uhr.unref(); })();` anstelle der echten
// `unref`-Zeile blieben BEIDE echten Stellen unbeanstandet — `Tests 2 failed | 62 passed (64)`, und
// rot waren nur seine zwei eigenen Proben. Der Grund: `var uhr` gehört der ganzen inneren Funktion.
// Wer es dem `if`-Block zurechnet, hält die innere Funktion für bindungsfrei, steigt in sie hinein
// und rechnet ihr `uhr.unref()` dem ÄUSSEREN Zeitgeber zu. Eine falsche Bindungsauflösung wirkt in
// BEIDE Richtungen; „vorsichtshalber strenger" gibt es hier nicht.
//
// SEITDEM WIRD GEBUNDEN, WIE DIE SPRACHE BINDET, und nicht näherungsweise: blockweit sind
// `let`/`const`/`using`, Klassen, Enums, Importe, Funktionsdeklarationen (diese Datei ist ein Modul,
// also strikt), Parameter und die `catch`-Variable; `var` zieht `varNamenIn` in die umschliessende
// Funktion (bzw. Datei, Modulrumpf, statischen Klassenblock) hoch und hält dabei an jeder
// Funktionsgrenze an. Kalibriert ist das in BEIDE Richtungen — BENs Probe als dritter Eintrag in
// `W7_FREMDE_BINDUNGEN` (falsch grün), und `W7_VAR_GRUEN`: ein mit `var` in einem inneren Block
// angelegter Zeitgeber, der weiter unten in derselben Funktion sein `unref()` bekommt, muss GRÜN
// bleiben (falsch rot). Wäre nur beanstandet worden, was unklar ist, bestünde dieser zweite Fall nicht.
//
// DIE ZAHL DER GELESENEN ANLEGESTELLEN STEHT IN DER AUSGABE DES FALLS. Eine Erhebung, die nichts
// gelesen hat, ist keine Entwarnung — dieselbe Regel wie in `toter-kandidatenweg.test.ts:794`.
//
// DIE HANDLE-DIAGNOSE, WIRKLICH GEFAHREN (JOB 3894, Lieferung 3) — und ihr Befund ist ein anderer
// als erwartet. Zuletzt am 13.09.2026 auf dem Cloud-Prüfplatz (Lauf `402c969715a5cd18ec7b18fd`):
//   npx vitest run --reporter=default --reporter=hanging-process --pool=forks
//     --poolOptions.forks.maxForks=4 --poolOptions.forks.minForks=1 tests/ask-rangfolge-kommentar
//     tests/ask/ask-retrieval-topk-scaling-contract.test.ts
//   → Exit 0 · `Tests 69 passed (69)` · Laufzeit 13,50 s, davon DIESE Datei 12408 ms (66 Fälle)
//   → der `hanging-process`-Reporter gab NULL Zeilen aus, stderr war leer.
// Der gemessene Stand ist der DIESER Datei ohne genau diese sieben Zeilen: eine Messung kann ihre
// eigene Laufkennung nicht enthalten. Die Zahlen des abschliessenden Laufs samt Wächterlauf stehen
// in der Rückgabe des Jobs, nicht hier — dieser Kommentar behauptet über das Tor nichts.
//
// WAS DIESE NULL WIRKLICH SAGT, und das wird hier nicht geglättet: sie ist WENIGER als eine
// Handle-Zählung. In Vitest 2.1.9 hat dieser Reporter genau eine wirksame Stelle
// (`node_modules/vitest/dist/chunks/index.DsZFoqi9.js:4284-4293`): `onInit` lädt `why-is-node-running`,
// gefragt wird es ausschliesslich in `onProcessTimeout` — also erst, wenn der Prozess beim Abräumen
// nicht endet. „Null Zeilen" heisst deshalb „kein Abräum-Zeitlimit", NICHT „null offene Handles
// gezählt". Genau darum kann diese Diagnose der Wächter nicht sein: sie schwiege auch bei fehlendem
// `unref`, solange der Zeitgeber ohnehin vorher abgeräumt wird oder von selbst feuert. Der Wächter
// ist W7; diese Messung ist der einmalige Befund des Ausgangszustands.
//
// OFFEN BLEIBT und wird nicht behauptet: (i) ob dieser Reporter auf jeder Maschine dasselbe liefert
// — gemessen ist die Cloud-Prüfmaschine dieses Jobs, nicht die Torstrecke; (ii) ob FREMDE
// Vorrichtungen dieser Suite eigene Handles halten — W7 liest ausschliesslich DIESE Datei, eine
// allgemeine `unref`-Regel über alle Testdateien wäre eine eigene Zeile mit eigener Kostenmessung.
//
// WAS W7 IM TOR KOSTET, gemessen und nicht geschätzt: im Torlauf der Runde 1 (JOB 3894, `tor.out:6036`)
// stand `Erhebung 120 ms` — auf der Torstrecke laufen sechs Forks nebeneinander, lokal waren es 25-38 ms.
// Der Grund waren ZWEI Parsedurchläufe über dieselben ~1700 Zeilen: der Fall ruft erst
// `zeitgeberstellen(selbst)` für die Zahl und dann `w7Befund(selbst)` für die Beanstandungen. Seit
// `W7_ERHEBUNGEN` ist es einer je Quelltext; gemessen am Cloud-Prüfplatz (13.09.2026, Lauf
// `feeb90a9095ad4ed957cb8a1`) sind daraus `Erhebung 24 ms` geworden. Die Auflösung der
// Gültigkeitsbereiche bleibt in derselben Grössenordnung, streut aber sichtbar: gemessen wurden
// `Erhebung 15 ms` (Lauf `7f02b865033f6a9f48008f40`), `21 ms` (`dae4d6dcf83f2e716bd0332e`) und
// `36 ms` (`402c969715a5cd18ec7b18fd`) — dieselbe Vorrichtung, dieselbe Datei, verschiedene
// Maschinenlast. Das Hochziehen der `var`-Namen (`varNamenIn`) läuft je var-Bereich EINMAL und wird
// wie jeder Bereich in `W7_BINDUNGEN` behalten; die Rümpfe dieser Datei sind klein. Die Zahl in der
// Ausgabe des Falls bleibt die Messung DIESES Laufs — was im nächsten Tor steht, sagt das Tor, nicht
// dieser Kommentar. Bleibt sie über 100 ms, gehört das in die nächste Rückgabe.
const W7_ZEITGEBER: ReadonlySet<string> = new Set(["setTimeout", "setInterval"]);

interface Zeitgeberstelle {
  /** `<pfad>:<zeile> „<Rohzeile>"` des Aufrufs — der Ort, den jede Beanstandung nennt. */
  readonly ort: string;
  /** Die benannte Funktion, in der er steht; `<Dateiebene>`, wenn es keine gibt. */
  readonly traeger: string;
  /** Der Name, unter dem der Zeitgeber gebunden wird; `undefined`, wenn er nicht gebunden wird. */
  readonly name: string | undefined;
  /**
   * Der GELESENE Bindungsbereich dieses Namens (`<pfad>:<zeile>`); `undefined`, wenn es keinen Namen
   * gibt ODER seine Deklaration im Quelltext nicht auffindbar war — der zweite Fall ist eine
   * Beanstandung, keine Entwarnung.
   */
  readonly bindungsort: string | undefined;
  /** Die erste Verwendung danach, GEFUNDEN und wörtlich — nicht der gesuchte Sollwert. */
  readonly ersteVerwendung: string | undefined;
  /**
   * Innere Bereiche NACH der Anlegestelle, die denselben Namen NEU binden. Ihr `unref()` gehört
   * einem anderen Ding; genau daran war Runde 2 falsch grün (Kopf oben).
   */
  readonly ueberschattung: readonly string[];
  /** Ist genau diese erste Verwendung ein `unref()`-Aufruf auf dem Zeitgeber? */
  readonly unref: boolean;
}

/** Ist `knoten` der `x.unref`-Zugriff eines WIRKLICHEN Aufrufs `x.unref()`? */
function istUnrefAufruf(knoten: ts.Node): boolean {
  return (
    ts.isPropertyAccessExpression(knoten) &&
    knoten.name.text === "unref" &&
    ts.isCallExpression(knoten.parent) &&
    knoten.parent.expression === knoten
  );
}

/** Ein echter VERWEIS auf den Namen — nicht die Benennung einer Eigenschaft oder Deklaration. */
function istVerweis(k: ts.Identifier): boolean {
  const eltern = k.parent;
  if (ts.isPropertyAccessExpression(eltern)) {
    return eltern.name !== k; // `eintrag.uhr` benennt eine Eigenschaft, es verweist nicht auf `uhr`.
  }
  if (
    ts.isVariableDeclaration(eltern) ||
    ts.isParameter(eltern) ||
    ts.isBindingElement(eltern) ||
    ts.isPropertyAssignment(eltern) ||
    ts.isPropertySignature(eltern) ||
    ts.isPropertyDeclaration(eltern)
  ) {
    return eltern.name !== k;
  }
  return true;
}

/** Jeder Name, den diese Bindungsform einführt — `{a, b: c}` und `[x, , y]` eingeschlossen. */
function namenIn(bindung: ts.BindingName, hinein: Set<string>): void {
  if (ts.isIdentifier(bindung)) {
    hinein.add(bindung.text);
    return;
  }
  for (const teil of bindung.elements) {
    if (ts.isBindingElement(teil)) {
      namenIn(teil.name, hinein);
    }
  }
}

/** Ein Gültigkeitsbereich: hier können Namen NEU gebunden werden und einen äusseren überschatten. */
function istBereich(k: ts.Node): boolean {
  return (
    ts.isSourceFile(k) ||
    ts.isBlock(k) ||
    ts.isModuleBlock(k) ||
    ts.isCaseBlock(k) ||
    ts.isForStatement(k) ||
    ts.isForInStatement(k) ||
    ts.isForOfStatement(k) ||
    ts.isCatchClause(k) ||
    ts.isClassLike(k) ||
    ts.isClassStaticBlockDeclaration(k) ||
    ts.isFunctionLike(k)
  );
}

/**
 * Ein Bereich, der `var` AUFNIMMT: Datei, Modulrumpf, statischer Klassenblock, jede Funktion. `var`
 * gilt für die ganze umschliessende FUNKTION und ist in dem Block, in dem es dasteht, NICHT gebunden.
 * Genau diese Unterscheidung fehlte bis Runde 3 (Kopf oben bei `W7_ZEITGEBER`).
 */
function istVarBereich(k: ts.Node): boolean {
  return (
    ts.isSourceFile(k) ||
    ts.isModuleBlock(k) ||
    ts.isClassStaticBlockDeclaration(k) ||
    ts.isFunctionLike(k)
  );
}

/** Ist diese Deklarationsliste `let`/`const`/`using` (blockweit) — im Gegensatz zu `var`? */
function istBlockweit(liste: ts.VariableDeclarationList): boolean {
  return (liste.flags & ts.NodeFlags.BlockScoped) !== 0;
}

/**
 * Die `var`-Namen DIESES var-Bereichs, aus allen inneren BLÖCKEN hochgezogen (`if`, `for`, `try`, …)
 * — aber niemals über eine Funktionsgrenze hinweg: ein `var` in einer inneren Funktion gehört ihr.
 */
function varNamenIn(bereich: ts.Node, namen: Set<string>): void {
  const gehe = (k: ts.Node): void => {
    if (istVarBereich(k)) {
      return; // eigener var-Bereich: seine `var` gehören ihm, nicht uns.
    }
    if (ts.isVariableDeclarationList(k) && !istBlockweit(k)) {
      for (const d of k.declarations) {
        namenIn(d.name, namen);
      }
    }
    ts.forEachChild(k, gehe);
  };
  ts.forEachChild(bereich, gehe);
}

const W7_BINDUNGEN = new WeakMap<ts.Node, ReadonlySet<string>>();

/**
 * Die Namen, die DIESER Bereich selbst bindet — nicht die seiner inneren Bereiche. Blockweit sind
 * `let`/`const`/`using`, Klassen, Enums, Importe, Funktionsdeklarationen (diese Datei ist ein Modul,
 * also strikt), Parameter und die `catch`-Variable; `var` dagegen wird nach den Regeln der Sprache
 * in die umschliessende FUNKTION hochgezogen (`varNamenIn`).
 *
 * BIS RUNDE 3 GALT HIER `var` ALS BLOCKBINDUNG, mit der Begründung, das sei „strenger als die
 * Sprache und höchstens falsch ROT". DIESE BEGRÜNDUNG WAR FALSCH, und BEN hat sie gemessen widerlegt
 * (Runde 3, Cloud-Lauf `c8feae2b4303d5505fdcb997`): sie wirkt in BEIDE Richtungen. Wird ein `var`
 * dem Block statt der Funktion zugerechnet, FEHLT es der Funktion — deren Bereich überschattet dann
 * nicht mehr, die Suche steigt in sie hinein und rechnet ihr `uhr.unref()` dem ÄUSSEREN Zeitgeber
 * zu. Das ist die stille Entwarnung, gegen die W7 gebaut ist. Dauerhaft kalibriert ist beides:
 * `W7_FREMDE_BINDUNGEN` (falsch grün) und `W7_VAR_GRUEN` (falsch rot).
 */
function eigeneBindungen(bereich: ts.Node): ReadonlySet<string> {
  const bekannt = W7_BINDUNGEN.get(bereich);
  if (bekannt !== undefined) {
    return bekannt;
  }
  const namen = new Set<string>();
  const ausListe = (liste: ts.VariableDeclarationList): void => {
    for (const d of liste.declarations) {
      namenIn(d.name, namen);
    }
  };
  const ausAnweisungen = (anweisungen: readonly ts.Statement[]): void => {
    for (const a of anweisungen) {
      if (ts.isVariableStatement(a)) {
        // Nur blockweite Deklarationen; `var` holt `varNamenIn` am Ende in den var-Bereich.
        if (istBlockweit(a.declarationList)) {
          ausListe(a.declarationList);
        }
      } else if (
        (ts.isFunctionDeclaration(a) || ts.isClassDeclaration(a) || ts.isEnumDeclaration(a)) &&
        a.name !== undefined
      ) {
        namen.add(a.name.text);
      } else if (ts.isImportDeclaration(a) && a.importClause !== undefined) {
        const klausel = a.importClause;
        if (klausel.name !== undefined) {
          namen.add(klausel.name.text);
        }
        if (klausel.namedBindings !== undefined) {
          if (ts.isNamespaceImport(klausel.namedBindings)) {
            namen.add(klausel.namedBindings.name.text);
          } else {
            for (const e of klausel.namedBindings.elements) {
              namen.add(e.name.text);
            }
          }
        }
      }
    }
  };
  if (ts.isFunctionLike(bereich)) {
    for (const p of bereich.parameters) {
      namenIn(p.name, namen);
    }
    if (
      (ts.isFunctionExpression(bereich) || ts.isFunctionDeclaration(bereich)) &&
      bereich.name !== undefined
    ) {
      namen.add(bereich.name.text);
    }
  } else if (ts.isCatchClause(bereich)) {
    if (bereich.variableDeclaration !== undefined) {
      namenIn(bereich.variableDeclaration.name, namen);
    }
  } else if (ts.isClassLike(bereich)) {
    if (bereich.name !== undefined) {
      namen.add(bereich.name.text);
    }
  } else if (ts.isSourceFile(bereich) || ts.isBlock(bereich) || ts.isModuleBlock(bereich)) {
    ausAnweisungen(bereich.statements);
  } else if (ts.isCaseBlock(bereich)) {
    for (const klausel of bereich.clauses) {
      ausAnweisungen(klausel.statements);
    }
  } else if (
    ts.isForStatement(bereich) ||
    ts.isForInStatement(bereich) ||
    ts.isForOfStatement(bereich)
  ) {
    const start = bereich.initializer;
    if (start !== undefined && ts.isVariableDeclarationList(start) && istBlockweit(start)) {
      ausListe(start);
    }
  }
  // `var` ZULETZT und nur hier: es gehört der umschliessenden Funktion, nicht dem Block.
  if (istVarBereich(bereich)) {
    varNamenIn(bereich, namen);
  }
  W7_BINDUNGEN.set(bereich, namen);
  return namen;
}

/**
 * Der Bereich, in dem der Zeitgebername WIRKLICH deklariert ist — gelesen, nicht geraten. Bei
 * `const uhr = setTimeout(…)` ist das der Block der Deklaration, bei `uhr = setTimeout(…)` der
 * Bereich mit dem `let uhr` (in `mitFrist` der Funktionsrumpf, nicht der Promise-Rückruf).
 * `undefined` heisst: keine Deklaration gefunden — dann urteilt W7 nicht grün, sondern beanstandet.
 */
function bindungsbereich(knoten: ts.Node, name: string): ts.Node | undefined {
  for (let p: ts.Node | undefined = knoten; p !== undefined; p = p.parent) {
    if (istBereich(p) && eigeneBindungen(p).has(name)) {
      return p;
    }
  }
  return undefined;
}

/** Die nächste umgebende benannte Funktion — sie steht in der Beanstandung statt einer nackten Zeile. */
function traegerVon(knoten: ts.Node): string {
  for (let p: ts.Node | undefined = knoten.parent; p !== undefined; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name !== undefined) {
      return p.name.text;
    }
  }
  return "<Dateiebene>";
}

function istZeitgeberaufruf(aufruf: ts.CallExpression): boolean {
  const ziel = aufruf.expression;
  const name = ts.isIdentifier(ziel)
    ? ziel.text
    : ts.isPropertyAccessExpression(ziel)
      ? ziel.name.text
      : undefined;
  return name !== undefined && W7_ZEITGEBER.has(name);
}

/**
 * Das Ergebnis je Quelltext, EINMAL erhoben. Der Schlüssel ist der vollständige Text samt Pfad — eine
 * veränderte Quelle ist ein anderer Schlüssel, keine Kalibrierung kann sich hier also an einem alten
 * Ergebnis vorbeimogeln (R1/R2/R3 sind mit dem Zwischenspeicher gemessen, nicht ohne ihn). Gehalten
 * werden nur die kleinen Fundlisten; der Syntaxbaum ist nach der Erhebung wieder frei.
 */
const W7_ERHEBUNGEN = new Map<string, readonly Zeitgeberstelle[]>();

function zeitgeberstellen(text: string, pfad = SELBST): readonly Zeitgeberstelle[] {
  // Längenpräfix statt Trennzeichen: ein Pfad, der zufällig wie der Anfang eines fremden
  // Quelltexts aussieht, kann so keinen fremden Schlüssel treffen.
  const schluessel = `${pfad.length}:${pfad}${text}`;
  const bekannt = W7_ERHEBUNGEN.get(schluessel);
  if (bekannt !== undefined) {
    return bekannt;
  }
  const funde = erhebeZeitgeberstellen(text, pfad);
  W7_ERHEBUNGEN.set(schluessel, funde);
  return funde;
}

function erhebeZeitgeberstellen(text: string, pfad: string): readonly Zeitgeberstelle[] {
  const datei = ast(text, pfad);
  const zeilen = text.split("\n");
  const stelle = (pos: number): string => {
    const nr = datei.getLineAndCharacterOfPosition(pos).line + 1;
    return `${pfad}:${nr} „${(zeilen[nr - 1] ?? "").trim()}"`;
  };
  const funde: Zeitgeberstelle[] = [];
  const gehe = (k: ts.Node): void => {
    if (ts.isCallExpression(k) && istZeitgeberaufruf(k)) {
      funde.push(bewerteZeitgeber(datei, k, stelle));
    }
    ts.forEachChild(k, gehe);
  };
  ts.forEachChild(datei, gehe);
  return funde;
}

function bewerteZeitgeber(
  datei: ts.SourceFile,
  aufruf: ts.CallExpression,
  stelle: (pos: number) => string,
): Zeitgeberstelle {
  const ort = stelle(aufruf.getStart(datei));
  const traeger = traegerVon(aufruf);
  const eltern = aufruf.parent;
  const leer = { bindungsort: undefined, ueberschattung: [] } as const;
  // (a) `setTimeout(…).unref()`: gar nicht erst gebunden, aber unmittelbar abgemeldet.
  if (istUnrefAufruf(eltern)) {
    return { ort, traeger, name: undefined, ersteVerwendung: ort, unref: true, ...leer };
  }
  // (b) `const uhr = setTimeout(…)` oder `uhr = setTimeout(…)`.
  const gebunden =
    ts.isVariableDeclaration(eltern) && ts.isIdentifier(eltern.name)
      ? eltern.name
      : ts.isBinaryExpression(eltern) &&
          eltern.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isIdentifier(eltern.left)
        ? eltern.left
        : undefined;
  if (gebunden === undefined) {
    return { ort, traeger, name: undefined, ersteVerwendung: undefined, unref: false, ...leer };
  }
  const name = gebunden.text;
  // DIE BINDUNG, NICHT DER NAME. Gesucht wird ausschliesslich im Bereich, der `name` deklariert;
  // ohne diesen Schritt wäre ein gleichnamiges fremdes Objekt ein gültiges `unref` (Runde 2).
  const bereich = bindungsbereich(aufruf, name);
  if (bereich === undefined) {
    return { ort, traeger, name, ersteVerwendung: undefined, unref: false, ...leer };
  }
  const ab = aufruf.getEnd();
  let erste: ts.Identifier | undefined;
  const ueberschattung: string[] = [];
  const suche = (k: ts.Node): void => {
    // Ein INNERER Bereich, der denselben Namen neu bindet, gehört einem anderen Ding: er wird nicht
    // betreten, sondern gemeldet — sonst zählte sein `unref()` für den Zeitgeber.
    if (k !== bereich && istBereich(k) && eigeneBindungen(k).has(name)) {
      if (k.getStart(datei) >= ab) {
        ueberschattung.push(stelle(k.getStart(datei)));
      }
      return;
    }
    if (
      ts.isIdentifier(k) &&
      k.text === name &&
      k.getStart(datei) >= ab &&
      istVerweis(k) &&
      (erste === undefined || k.getStart(datei) < erste.getStart(datei))
    ) {
      erste = k;
    }
    ts.forEachChild(k, suche);
  };
  suche(bereich);
  return {
    ort,
    traeger,
    name,
    bindungsort: stelle(bereich.getStart(datei)),
    ersteVerwendung: erste === undefined ? undefined : stelle(erste.getStart(datei)),
    ueberschattung,
    unref: erste !== undefined && istUnrefAufruf(erste.parent),
  };
}

/**
 * Die Beanstandungen, eine Zeile je Anlegestelle ohne `unref`. Jede nennt Träger, Datei, Zeile und
 * den GEFUNDENEN Text — nicht den gesuchten (Lehre JOB 3826 R1, hier wie in
 * `toter-kandidatenweg.test.ts:140-142`).
 */
function w7Befund(text: string, pfad = SELBST): readonly string[] {
  return zeitgeberstellen(text, pfad).flatMap((s) => {
    if (s.unref) {
      return [];
    }
    if (s.name === undefined) {
      return [
        `W7: ${s.traeger}: der Zeitgeber wird weder gebunden noch unmittelbar abgemeldet — angelegt ${s.ort}`,
      ];
    }
    if (s.bindungsort === undefined) {
      return [
        `W7: ${s.traeger}: die Deklaration von \`${s.name}\` ist im Quelltext nicht auffindbar — angelegt ${s.ort}; ohne gelesene Bindung wird hier nicht grün geurteilt`,
      ];
    }
    // Die Überschattung gehört in die MELDUNG: ohne sie liest man „kein `unref()`" neben einem
    // dastehenden `uhr.unref()` und hält den Wächter für kaputt statt den Quelltext.
    const fremd = s.ueberschattung[0];
    const nachtrag =
      fremd === undefined
        ? ""
        : `; der Name wird in einem inneren Bereich NEU gebunden (${s.ueberschattung.length}×), zuerst ${fremd} — dessen \`unref()\` gilt nicht dem Zeitgeber`;
    return [
      `W7: ${s.traeger}: \`${s.name}\` bekommt vor seiner ersten Verwendung kein \`unref()\` — angelegt ${s.ort}; erste Verwendung ${s.ersteVerwendung ?? "<keine im Bindungsbereich>"}${nachtrag}`,
    ];
  });
}

/**
 * Die zwei heutigen Anlegestellen. Die Zahl ist die Untergrenze der Erhebung, keine Aufzählung: eine
 * DRITTE Anlegestelle macht W7 nicht grün, sondern muss ihr eigenes `unref` mitbringen.
 */
const W7_TRAEGER = ["mitFrist", "verzoegere"] as const;

/** Die gestellte dritte Anlegestelle — einzeilig, damit `FREMDTEXT` sie auch als `//` blind hält. */
const W7_DRITTE =
  "function dritterZeitgeber() { const spaet = setTimeout(() => {}, 1); clearTimeout(spaet); }";

/**
 * DIE ZWEI ECHTEN `unref`-ZEILEN ALS ANKER, jede mit ihrer Folgezeile, damit sie im Quelltext
 * EINDEUTIG sind. Sie stehen hier als Literal mit `\n` und können deshalb nicht sich selbst treffen;
 * die erste Fundstelle ist immer der echte Quelltext (`mitFrist` bzw. `verzoegere`).
 */
const W7_ECHT_MITFRIST = "    uhr.unref();\n  });";
const W7_ECHT_VERZOEGERE = "  uhr.unref();\n  eintrag.uhr = uhr;";
const W7_ECHTE_STELLEN = [
  ["mitFrist", W7_ECHT_MITFRIST],
  ["verzoegere", W7_ECHT_VERZOEGERE],
] as const;

/**
 * BENs Gegenprobe aus Runde 2, dauerhaft und in zwei Formen: DERSELBE Name, eine ANDERE Bindung.
 * Beide Formen schreiben `uhr.unref()` in den Quelltext, keine von beiden meldet den Zeitgeber ab.
 * Eine Zeichenkettensuche und jede Namensgleichheit sind hier grün; W7 muss rot sein.
 */
const W7_FREMDE_BINDUNGEN = [
  ["innerer Block", "{ const uhr = { unref() {} }; uhr.unref(); }"],
  ["Rückrufparameter", "[{ unref() {} }].forEach((uhr) => uhr.unref());"],
  // BENs Gegenprobe aus Runde 3, wörtlich übernommen (Cloud-Lauf `c8feae2b4303d5505fdcb997`):
  // damals `Tests 2 failed | 62 passed (64)` mit `expected [] to have a length of 1 but got +0` —
  // W7 lieferte für BEIDE defekten Quellen keine Beanstandung. Das `var` steht in einem inneren
  // BLOCK, gilt aber für die ganze innere Funktion; wer es dem Block zurechnet, hält die innere
  // Funktion für bindungsfrei, steigt in sie hinein und schreibt ihr `uhr.unref()` dem ÄUSSEREN
  // Zeitgeber gut.
  [
    "`var` im Block einer inneren Funktion",
    "(() => { if (true) { var uhr = { unref() {} }; } uhr.unref(); })();",
  ],
] as const;

/**
 * DIE GEGENRICHTUNG ZUM `var`-FALL, und sie ist der Grund, warum hier wirklich der Bindungsbereich
 * aufgelöst wird statt jedes `var` vorsichtshalber zu beanstanden: ein Zeitgeber, der mit `var` in
 * einem inneren Block angelegt und WEITER UNTEN in derselben Funktion abgemeldet wird, ist korrekt —
 * `spaetVar` ist funktionsweit gebunden. Eine Auflösung, die `var` als Blockbindung liest, findet
 * die erste Verwendung nicht mehr und ist hier falsch ROT; eine falsch rote Wache wird abgeschaltet.
 */
const W7_VAR_GRUEN =
  "function varZeitgeber() { if (true) { var spaetVar = setTimeout(() => {}, 1); } spaetVar.unref(); }";

/** Und dass das Hochziehen keine neue blinde Stelle aufmacht: dieselbe Form OHNE `unref` ist ROT. */
const W7_VAR_ROT =
  "function varZeitgeberOhne() { if (true) { var ohneVar = setTimeout(() => {}, 1); } clearTimeout(ohneVar); }";

interface W6Lauf {
  /**
   * JOB 3868 — hängt an den VM-Rumpf eine abschliessende Anweisung, deren Wert NICHT das
   * Kandidaten-Promise ist. Ohne sie ist die letzte Anweisung die ZUWEISUNG `aufzeichnung.lauf = …`;
   * `runInNewContext` gibt deren Wert zurück, und schon die ERSTE Wartestelle fängt ab. Mit ihr
   * kehrt `fuehreGelesenAus` sofort zurück, und nur die ZWEITE kann noch warten. Vorgabe: aus —
   * jeder Bestandsfall läuft unverändert durch dieselbe Funktion.
   */
  readonly neutralerAbschluss?: boolean;
}

/**
 * Holt die Attrappe mit dem vorhandenen `attrappe()` (strukturell, nicht über den Namen), druckt sie
 * OHNE Kommentare, befreit sie von den Typen und RUFT SIE AUF. Jeder Ausfall ist rot mit Grund und
 * mit dem gelesenen Ausschnitt — nie „nicht gefunden, also in Ordnung" (Zustandsmodell, wie W5).
 */
async function fuehreAttrappeAus(
  text: string,
  pfad = VERTRAG,
  optionen: W6Lauf = {},
): Promise<Doppelgaenger> {
  const mock = attrappe(text, pfad);
  const gedruckt = drucke(mock, mock.getSourceFile());
  const fehler = (grund: string): Error =>
    new Error(`W6: ${pfad}: ${grund}; gelesener Ausschnitt: ${gedruckt}`);
  const name = mock.name?.text;
  if (name === undefined) {
    throw fehler("die Attrappe hat keinen Namen und ist so nicht aufrufbar");
  }
  const aufzeichnung: { lauf?: Promise<unknown>; abgeschlossen?: boolean } = {};
  let geliefert: unknown;
  try {
    await mitFrist(
      fuehreGelesenAus(
        [gedruckt],
        `const gebaut = ${name}(bestand);
      const quelle =
        gebaut && typeof gebaut.findCandidates === "function"
          ? gebaut
          : gebaut && gebaut.koService && typeof gebaut.koService.findCandidates === "function"
            ? gebaut.koService
            : undefined;
      if (quelle === undefined) {
        throw new Error("der Rückgabewert trägt kein aufrufbares findCandidates");
      }
      aufzeichnung.lauf = Promise.resolve(quelle.findCandidates(anfrage)).then((seite) =>
        Array.from(seite, (ko) => String(ko && ko.id)),
      );${optionen.neutralerAbschluss === true ? "\n      aufzeichnung.abgeschlossen = true;" : ""}`,
        {
          aufzeichnung,
          bestand: w6Bestand(),
          anfrage: { terms: [...W6_TERME], limit: W6_LIMIT },
          verzoegere,
        },
      ),
    );
    if (optionen.neutralerAbschluss === true && aufzeichnung.abgeschlossen !== true) {
      // Sonst mässe der Fall still die ERSTE Wartestelle, obwohl er die zweite meint.
      throw new Error("der neutrale Abschluss des VM-Rumpfs wurde nicht erreicht");
    }
    if (aufzeichnung.lauf === undefined) {
      throw new Error("die Attrappe hat keine Kandidatenabfrage begonnen");
    }
    geliefert = await mitFrist(aufzeichnung.lauf);
  } catch (error) {
    throw error instanceof Frist
      ? fehler(error.message)
      : fehler(`die Attrappe lief nicht: ${String(error)}`);
  }
  if (!Array.isArray(geliefert)) {
    throw fehler(`die Attrappe lieferte keine Liste: ${String(geliefert)}`);
  }
  return {
    geliefert: [...(geliefert as string[])],
    name,
    ort: zeileVon(text, pfad, `function ${name}`),
  };
}

/** Beide Reihenfolgen, in jeder roten W6-Meldung: eine Anzahl ersetzt keine IDs (BEN, Pflicht 2). */
function w6Reihenfolgen(lauf: Doppelgaenger): string {
  return `geliefert (${lauf.geliefert.join(" → ")}), erwartet (${W6_STOERER.join(" → ")})`;
}

/**
 * JOB 3826 R2 — DER GRUND WIRD AUS DEM ERGEBNIS ABGELEITET (BEN, Korrekturpflicht 1).
 *
 * Runde 1 behauptete in JEDER roten Rangfolge-Meldung einen gelieferten Zieltreffer. BENs Messung
 * widerlegte das: bei umgedrehter Störerreihenfolge kamen ausschliesslich `stoerer-2 → stoerer-1 →
 * stoerer-0` zurück, das Ziel war gar nicht dabei — die Meldung nannte einen Treffer, den es nicht
 * gab. Deshalb entscheidet hier `geliefert`, welcher der beiden Gründe dasteht, und die Stelle des
 * Ziels wird gezählt, nicht vermutet.
 */
function w6Rangfolge(lauf: Doppelgaenger): string {
  const stelle = lauf.geliefert.indexOf(W6_ZIEL);
  const grund =
    stelle >= 0
      ? `sortiert RELEVANZBEWUSST: „${W6_ZIEL}" steht an Stelle ${stelle + 1} von ${W6_LIMIT} — damit härtet ${VERTRAG} gegen eine Quelle, die das Problem nicht mehr hat`
      : `hält „${W6_ZIEL}" zwar draussen, liefert aber nicht die gemessene (validiert ↓, Trust ↓)-Auswahl — ihre Relevanzblindheit ist damit nicht mehr belegt`;
  return `W6 Rangfolge: ${lauf.ort}: die Attrappe \`${lauf.name}\` ${grund}; ${w6Reihenfolgen(lauf)}`;
}

async function pruefeAttrappe(text: string, pfad = VERTRAG, optionen: W6Lauf = {}): Promise<void> {
  const lauf = await fuehreAttrappeAus(text, pfad, optionen);
  // ERST das Limit: eine unwirksame Deckelung soll an ihrem EIGENEN Grund scheitern, nicht am
  // Rangfolge-Grund — sonst nennt die Meldung eine Ursache, die nicht die Ursache ist.
  expect(
    lauf.geliefert.length,
    `W6 Limit: ${lauf.ort}: die Attrappe \`${lauf.name}\` schneidet nicht auf das Limit ${W6_LIMIT}; ${w6Reihenfolgen(lauf)}`,
  ).toBe(W6_LIMIT);
  expect(lauf.geliefert, w6Rangfolge(lauf)).toEqual([...W6_STOERER]);
}

// BENs Mutation aus `ben.md:24`, wörtlich nachgebaut: die Zahl der abgedeckten Terme als ERSTE
// Sortierstufe. Sie geschieht NUR im Speicher — die Vertragsdatei wird gelesen, nie geschrieben.
const REINE_RANGFOLGE =
  'Number(b.status === "validiert") - Number(a.status === "validiert") || b.trust - a.trust';
const TREFFERZAHL_ZUERST = `${[
  'terms.filter((t) => (b.title + " " + b.statement).toLowerCase().includes(t)).length',
  'terms.filter((t) => (a.title + " " + a.statement).toLowerCase().includes(t)).length',
].join(" - ")} || `;
const SORT_ANKER = "const sortiert = [...treffer].sort(";
const NACHGEZOGEN = () => ersetzen(vertrag, REINE_RANGFOLGE, TREFFERZAHL_ZUERST + REINE_RANGFOLGE);

/**
 * JOB 3894 — DER EINE ANKER FÜR DIE RÜCKGABEZEILE DER ATTRAPPE.
 *
 * Fall A („mit NEUTRALEM Abschluss …") und Fall B („eine VERSPÄTET antwortende Attrappe …")
 * verstellen dieselbe Zeile des Vertrags. Bis JOB 3868 stand ihr Wortlaut ZWEIMAL im Falltext, und
 * eine Verstellung traf dann nur je einen Fall — aufgefallen, aber nicht gebaut
 * (`archiv/3868/runde-2/RUECKGABE.md:62`). Jetzt lesen beide diese EINE Konstante: wer sie
 * verstellt, macht BEIDE Fälle rot. Ein zweiter Verstellweg daneben entsteht dabei nicht.
 */
const W6_RUECKGABE_ZEILE = "return Promise.resolve(seite);";

// Dieselbe Trefferzahl als BLINDER TEXT. W6 muss dabei GRÜN bleiben, denn das Verhalten ist
// unverändert; ein Wächter, der hier rot wird, ist ein Wörterbuch und kein Messgerät (3570 R3,
// 3579 R1). Ein Falltitel ist nur auf DATEIEBENE blind: `it(...)` im Rumpf der Attrappe wäre ein
// Aufruf und damit gerade kein blinder Text. Das ist die bewusste Grenze dieser Kalibrierung.
const SCHEINSTUFEN = [
  [
    "Kommentar in der Attrappe",
    (blind: string) => ersetzen(vertrag, SORT_ANKER, `// ${blind}\n      ${SORT_ANKER}`),
  ],
  [
    "Stringliteral in der Attrappe",
    (blind: string) =>
      ersetzen(
        vertrag,
        SORT_ANKER,
        `const scheinbeleg = ${JSON.stringify(blind)};\n      ${SORT_ANKER}`,
      ),
  ],
  [
    "Falltitel in der Datei",
    (blind: string) => `${vertrag}\nit(${JSON.stringify(blind)}, () => {});\n`,
  ],
] as const;

// JOB 3850 — eine ZWEITE Quelle, auf EINER Zeile. Sie muss den strukturellen Filter wirklich
// passieren (Funktionsdeklaration mit ausführbarem `findCandidates`-Glied im Rumpf), und sie bleibt
// einzeilig, weil `FREMDTEXT` sie sonst als `//`-Kommentar nicht blind halten könnte: ab der zweiten
// Zeile wäre sie wieder Code, und die Gegenrichtung des Mehrdeutigkeitsfalls wäre wertlos.
const ZWEITE_QUELLE =
  "function nochEineSchwacheQuelle() { return { findCandidates(query) { return Promise.resolve([]); } }; }";

describe("JOB 3601: Erklärung und Abfrage stimmen überein", () => {
  it("W1 liest die gebaute ORDER BY-Kette aus der AST-Methode", async () => {
    const gelesen = await pgRangfolge(pg);
    expect(gelesen.kette.length, `${PG}: leere Kette`).toBeGreaterThan(0);
    // Der wörtliche `ORDER BY` ist kein Beiwerk: er ist der Beleg, den jede rote Meldung trägt.
    expect(gelesen.orderBy, `${PG}: gelesener ORDER BY`).toMatch(/^ORDER BY \(CASE WHEN /);
    expect(gelesen.orderBy).toContain("(status='validiert') DESC");
  });

  it("W2 bindet die PgKoRepo-Erklärung an die gelesene Kette", async () => {
    await pruefeService(service, pg);
  });

  it("W3 bindet beide Vertragsstellen an die bewusst schwächere Quelle", async () => {
    await pruefeVertrag(vertrag, pg);
  });

  it("W4: eine umbenannte echte Trefferzahl bleibt lesbar", async () => {
    expect(await pgRangfolge(pg.replace(/\btrefferzahl\b/g, "relevanzsumme"))).toEqual(
      await pgRangfolge(pg),
    );
  });

  for (const [name, einbetten] of FREMDTEXT) {
    it(`W4: SQL-Stichwort als ${name} ersetzt keine Sortierstufe`, async () => {
      const arbeitskopie = OHNE_TREFFER() + einbetten("ORDER BY (${trefferzahl}) DESC,");
      expect((await pgRangfolge(arbeitskopie)).kette).toEqual(["validiert ↓", "Trust ↓"]);
      expect((await pgRangfolge(arbeitskopie)).kette).not.toEqual((await pgRangfolge(pg)).kette);
    });

    it(`W4: Service-Stichwort als ${name} ersetzt keine Aufzählung`, async () => {
      const defekt = service.replace(/^\/\/\s*· PgKoRepo.*$/m, "//   · Quelle unbekannt.");
      expect(defekt).not.toBe(service);
      await expect(
        pruefeService(
          defekt + einbetten("· PgKoRepo sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓)"),
          pg,
        ),
      ).rejects.toThrow(/W2/);
    });

    it(`W4: Vertragshinweis als ${name} ersetzt keine der zwei Stellen`, async () => {
      // Ausgangspunkt ist die echte Datei, nicht eine positive Ersatzfassung. Nach Red-first
      // trägt sie zwei Hinweise; jede einzelne Entfernung muss den zugehörigen W3-Fall treffen.
      const stellen = [...vertrag.matchAll(new RegExp(HINWEIS, "g"))].map((m) => m.index);
      expect(stellen).toHaveLength(ANKER);
      for (const pos of stellen) {
        const defekt = vertrag.slice(0, pos) + vertrag.slice(pos + HINWEIS.length);
        await expect(pruefeVertrag(defekt + einbetten(HINWEIS), pg)).rejects.toThrow(/W3/);
      }
    });
  }

  it("W4: bloße Gleichheitsbehauptung an jeder der zwei Stellen ist rot", async () => {
    const stellen = [...vertrag.matchAll(new RegExp(HINWEIS, "g"))].map((m) => m.index);
    expect(stellen).toHaveLength(ANKER);
    for (const pos of stellen) {
      const defekt = `${vertrag.slice(0, pos)}exakt wie heute nach${vertrag.slice(pos + HINWEIS.length)}`;
      await expect(pruefeVertrag(defekt, pg)).rejects.toThrow(/W3/);
    }
  });

  it("W4: vertauschte Stufen und falsche Richtung widersprechen der Service-Erklärung", async () => {
    for (const neu of [
      "ORDER BY (status='validiert') DESC, (${trefferzahl}) DESC,",
      "ORDER BY (${trefferzahl}) ASC, (status='validiert') DESC,",
    ]) {
      const defekt = ersetzen(
        pg,
        "ORDER BY (${trefferzahl}) DESC, (status='validiert') DESC,",
        neu,
      );
      await expect(pruefeService(service, defekt)).rejects.toThrow(/W2:/);
    }
  });

  // ==============================================================================================
  // JOB 3617 · DIE VIER GEGENPROBEN ALS FÄLLE — NICHT ALS SÄTZE IN EINER RÜCKGABE.
  // ==============================================================================================
  // (a) der widerlegte Satz ist zurück → rot. (b) das SQL verliert die Trefferzahl, die Erklärung
  // bleibt neu → rot mit der UMGEKEHRTEN Meldung. (c) der `ORDER BY`-Text steht nur in einem
  // Kommentar → rot (die FREMDTEXT-Fälle oben). (d) der stimmige Stand → grün (W1–W3, W5).

  it("W2 Gegenprobe (a): der alte Satz „OHNE Relevanzmaß“ im Service ist rot", async () => {
    const defekt = ersetzen(
      service,
      "//   · PgKoRepo sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓) und deckelt in der Abfrage.",
      ALTER_SATZ_SERVICE,
    );
    // Der historische SQL-Wortlaut wird VERSTANDEN (nicht bloß nicht erkannt) und dann widerlegt:
    // seine zwei Stufen stehen gegen die drei gelesenen. Die Meldung muss den ORT der Behauptung
    // (Datei UND Zeile), die behauptete Rangfolge und den WIRKLICH gelesenen `ORDER BY` nennen —
    // eine abstrahierte Kette allein schickt den Nächsten auf die Suche (BEN Runde 1, Pflicht 2).
    const fehler = await abgewiesen(pruefeService(defekt, pg));
    expect(fehler).toMatch(/W2: services\/ask\/src\/service\.ts:\d+ behauptet/);
    expect(fehler).toContain("behauptet (validiert ↓ → Trust ↓)");
    expect(fehler).toMatch(/liest `ORDER BY \(CASE WHEN .+ THEN 1 ELSE 0 END/);
    expect(fehler).toContain("= Term-Trefferzahl ↓ → validiert ↓ → Trust ↓");
    expect(fehler).toContain(zeileVon(defekt, ASK, "· PgKoRepo sortiert"));
  });

  it("W3 Gegenprobe (a): der alte Satz „OHNE Relevanzmaß“ im Vertrag ist rot", async () => {
    const defekt = ersetzen(
      vertrag,
      "//   · PgKoRepo.findCandidates sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓).",
      ALTER_SATZ_VERTRAG,
    );
    const fehler = await abgewiesen(pruefeVertrag(defekt, pg));
    expect(fehler).toMatch(
      /W3 Befund: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts:\d+ behauptet/,
    );
    expect(fehler).toContain("behauptet (validiert ↓ → Trust ↓)");
    expect(fehler).toMatch(/liest `ORDER BY \(CASE WHEN .+ THEN 1 ELSE 0 END/);
    expect(fehler).toContain(zeileVon(defekt, VERTRAG, "· PgKoRepo.findCandidates sortiert"));
  });

  it("W2 Gegenprobe (b): SQL ohne Trefferzahl, Erklärung neu → rot mit dem gelesenen ORDER BY", async () => {
    // Die umgekehrte Richtung: nicht die Erklärung ist alt, das SQL ist zurückgefallen. Die Meldung
    // nennt den WIRKLICH gelesenen, kürzeren `ORDER BY` — sonst wäre der Wächter nur in eine
    // Richtung dicht, und niemand sähe, WAS die Abfrage heute tut.
    const fehler = await abgewiesen(pruefeService(service, OHNE_TREFFER()));
    expect(fehler).toContain("behauptet (Term-Trefferzahl ↓ → validiert ↓ → Trust ↓)");
    expect(fehler).toContain(
      "liest `ORDER BY (status='validiert') DESC, (data->>'trust')::int DESC NULLS LAST`",
    );
    expect(fehler).toContain("= validiert ↓ → Trust ↓");
    expect(fehler).toContain(zeileVon(service, ASK, "· PgKoRepo sortiert"));
  });

  it("W3 Gegenprobe (b): SQL ohne Trefferzahl macht auch den Vertragskopf rot", async () => {
    const fehler = await abgewiesen(pruefeVertrag(vertrag, OHNE_TREFFER()));
    expect(fehler).toContain("behauptet (Term-Trefferzahl ↓ → validiert ↓ → Trust ↓)");
    expect(fehler).toContain(
      "liest `ORDER BY (status='validiert') DESC, (data->>'trust')::int DESC NULLS LAST`",
    );
    expect(fehler).toContain(zeileVon(vertrag, VERTRAG, "· PgKoRepo.findCandidates sortiert"));
  });

  // ==============================================================================================
  // JOB 3617 R2 · KORREKTURPFLICHT 1 (BEN) — DER WIDERSPRUCH NEBEN DER RICHTIGEN LISTE.
  // ==============================================================================================
  // BENS MESSUNG: „Im Service-Spiegelstrich nach ‚und deckelt in der Abfrage.' ergänzt: ‚PgKoRepo
  // rankt OHNE Relevanzmass.' Erwartetes Rot blieb aus." Der Grund war, dass nur der Klammerinhalt
  // gelesen wurde und der Folgetext niemanden interessierte. Eine Erklärung, die im selben Atemzug
  // die richtige Kette nennt UND ihr Fehlen behauptet, ist nicht halb richtig — sie ist unbrauchbar.
  for (const widerspruch of [
    "PgKoRepo rankt OHNE Relevanzmass.",
    "PgKoRepo sortiert ohne jedes Relevanzmaß.",
    "Der Produktionsadapter deckelt nur nach validiert/Trust.",
  ]) {
    it(`W2 Widerspruch: „${widerspruch}" neben der richtigen Liste ist rot`, async () => {
      const defekt = ersetzen(
        service,
        "//   · PgKoRepo sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓) und deckelt in der Abfrage.",
        `//   · PgKoRepo sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓) und deckelt in der Abfrage.\n// ${widerspruch}`,
      );
      const fehler = await abgewiesen(pruefeService(defekt, pg));
      expect(fehler).toMatch(/W2 Widerspruch: services\/ask\/src\/service\.ts:\d+/);
      expect(fehler).toContain(widerspruch);
      expect(fehler).toMatch(/liest `ORDER BY \(CASE WHEN .+ THEN 1 ELSE 0 END/);
      expect(fehler).toContain(zeileVon(defekt, ASK, widerspruch));
    });

    it(`W3 Widerspruch: „${widerspruch}" neben der richtigen Liste ist rot`, async () => {
      const defekt = ersetzen(
        vertrag,
        "//   · PgKoRepo.findCandidates sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓).",
        `//   · PgKoRepo.findCandidates sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓).\n// ${widerspruch}`,
      );
      const fehler = await abgewiesen(pruefeVertrag(defekt, pg));
      expect(fehler).toMatch(
        /W3 Widerspruch: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts:\d+/,
      );
      expect(fehler).toContain(widerspruch);
      expect(fehler).toContain(zeileVon(defekt, VERTRAG, widerspruch));
    });
  }

  it("W3 Widerspruch: auch im Docstring der Attrappe, nicht nur im Dateikopf", async () => {
    // Die zweite bewachte Stelle wird von einer EIGENEN Prüfung gelesen. Ohne diesen Fall wäre sie
    // nie ausgeführt — und eine nie ausgeführte Prüfung belegt nichts (Lehre JOB 3581 R1).
    const defekt = ersetzen(
      vertrag,
      " * KEIN Relevanzmaß — die adapterunabhängige Härtung",
      " * PgKoRepo rankt OHNE Relevanzmass. KEIN Relevanzmaß — die adapterunabhängige Härtung",
    );
    const fehler = await abgewiesen(pruefeVertrag(defekt, pg));
    expect(fehler).toMatch(
      /W3 Widerspruch: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts:\d+/,
    );
    expect(fehler).toContain("PgKoRepo rankt OHNE Relevanzmass.");
    expect(fehler).toContain(zeileVon(defekt, VERTRAG, "PgKoRepo rankt OHNE Relevanzmass."));
  });

  it("W2/W3 Widerspruch KALIBRIERUNG: die historisch markierten Sätze bleiben grün", async () => {
    // „Damals sortierte PgKoRepo nur nach validiert/Trust." trägt dieselbe Verneinung wie die
    // Gegenproben oben — und ist RICHTIG, weil sie als Vergangenheit markiert ist. Verschwindet
    // die Marke, ist derselbe Satz eine Aussage über heute und muss rot werden.
    expect(service).toContain("Damals sortierte\n// PgKoRepo nur nach validiert/Trust.");
    expect(vertrag).toContain("Damals sortierte PgKoRepo nur nach validiert/Trust,");
    await pruefeService(service, pg);
    await pruefeVertrag(vertrag, pg);
    const ohneMarke = service.replace(
      "Damals sortierte\n// PgKoRepo",
      "Heute sortiert\n// PgKoRepo",
    );
    expect(ohneMarke).not.toBe(service);
    expect(await abgewiesen(pruefeService(ohneMarke, pg))).toMatch(/W2 Widerspruch/);
  });

  it("W2/W3 Widerspruch: bei SQL OHNE Relevanzstufe ist die Verneinung KEIN Widerspruch", async () => {
    // Die Prüfung hängt am gelesenen SQL, nicht an einer Wortliste: fällt die Trefferzahl weg, ist
    // „OHNE Relevanzmass" wahr. Rot bleibt es dann wegen der Rangfolge (Gegenprobe b) — aber NICHT
    // als Widerspruch, sonst wäre der Wächter ein Wörterbuch und kein Messgerät.
    const defekt = ersetzen(
      service,
      "//   · PgKoRepo sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓) und deckelt in der Abfrage.",
      "//   · PgKoRepo sortiert (validiert ↓, Trust ↓) und deckelt OHNE Relevanzmass.",
    );
    await pruefeService(defekt, OHNE_TREFFER());
  });

  it("W5: der Name der Attrappe darf den Produktionsadapter nicht behaupten", async () => {
    const name = attrappe(vertrag).name?.text ?? "";
    expect(name, `${VERTRAG}: Attrappenname`).not.toMatch(/pg|postgres|produktion/i);
    // Gegenprobe: der alte Name ist zurück → rot, obwohl jeder Kommentar der Datei stimmt.
    await expect(
      pruefeVertrag(vertrag.replaceAll(name, "pgAehnlicherKoService"), pg),
    ).rejects.toThrow(/W5: .*benennt sich nach dem Produktionsadapter/);
  });

  it("W5 Zustandsmodell: verlorene Attrappe ist rot mit Grund, nicht still grün", () => {
    // Kein ausführbares `findCandidates` mehr — der Name allein in Kommentar/Literal/Falltitel
    // hält den Wächter nicht sehend. Er muss sein Ziel als verloren melden.
    for (const [, einbetten] of FREMDTEXT) {
      const defekt =
        ersetzen(vertrag, "findCandidates(query: KoCandidateQuery)", "sucheKandidaten(query)") +
        einbetten("findCandidates(query) { return []; }");
      expect(() => attrappe(defekt)).toThrow(
        /W5: tests\/ask\/ask-retrieval-topk-scaling-contract.test.ts: Attrappe .* fehlt\/mehrdeutig; gefunden: 0/,
      );
    }
  });

  // ==============================================================================================
  // JOB 3826 · W6 — DIE FÄLLE. Der Kopf dieser Wache steht oben bei `W6_TERME`.
  // ==============================================================================================

  it("W6: die AUSGEFÜHRTE Attrappe lässt den passenden Treffer ausserhalb des Limits", async () => {
    // Kalibrierung des gestellten Bestands: ohne mehrere Begriffe und ohne genau so viele Störer,
    // wie das Limit trägt, entscheidet er die Frage nicht — dann wäre dieses Grün wertlos.
    expect(W6_TERME.length, "W6: der Bestand braucht mehrere Fragebegriffe").toBeGreaterThanOrEqual(
      2,
    );
    expect(W6_STOERER.length, "W6: die Störer müssen das Limit allein füllen").toBe(W6_LIMIT);
    await pruefeAttrappe(vertrag);
  });

  it("W6 Gegenprobe: der nachgezogene Doppelgänger ist rot — mit Ort, Zeile und beiden Reihenfolgen", async () => {
    // DIE ABNAHME DIESES AUFTRAGS: genau BENs Mutation, die am 3601-Stand `Tests 22 passed` ergab.
    const defekt = NACHGEZOGEN();
    const name = attrappe(defekt).name?.text ?? "";
    const fehler = await abgewiesen(pruefeAttrappe(defekt));
    expect(fehler).toMatch(
      /W6 Rangfolge: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts:\d+:/,
    );
    expect(fehler).toContain(zeileVon(defekt, VERTRAG, `function ${name}`));
    expect(fehler).toContain(`geliefert (${W6_ZIEL} → ${W6_STOERER[0]} → ${W6_STOERER[1]})`);
    expect(fehler).toContain(`erwartet (${W6_STOERER.join(" → ")})`);
    // Der Grund ist hier der starke — und er ist gedeckt: das Ziel steht WIRKLICH an Stelle 1.
    expect(fehler).toContain(`sortiert RELEVANZBEWUSST: „${W6_ZIEL}" steht an Stelle 1 von 3`);
  });

  it("W6 Kalibrierung: ein unwirksames Limit ist rot mit EIGENEM Grund, nicht mit dem Rangfolge-Grund", async () => {
    // Die zweite Halbheit, die ausgeschlossen sein muss: nur den Sortiervergleich prüfen und das
    // Limit vergessen. Hier ändert sich das Verhalten wirklich, aber nicht die Sortierung.
    const defekt = ersetzen(
      vertrag,
      "sortiert.slice(0, Math.max(0, Math.floor(query.limit)))",
      "sortiert",
    );
    const fehler = await abgewiesen(pruefeAttrappe(defekt));
    expect(fehler).toMatch(
      /W6 Limit: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts:\d+:/,
    );
    expect(fehler).toContain(`schneidet nicht auf das Limit ${W6_LIMIT}`);
    expect(fehler).toContain(`geliefert (${W6_STOERER.join(" → ")} → ${W6_ZIEL})`);
    // BEN, Korrekturpflicht 2: auch der Limitfehler nennt die ERWARTETE ID-Reihenfolge. Runde 1
    // meldete hier nur `expected 4 to be 3` — eine Anzahl schickt den Nächsten wieder auf die Suche.
    expect(fehler).toContain(`erwartet (${W6_STOERER.join(" → ")})`);
    expect(fehler).not.toContain("W6 Rangfolge");
  });

  it("W6 Kalibrierung: umgedrehte Störer sind rot, OHNE einen Zieltreffer zu behaupten", async () => {
    // BENs Widerlegung aus Runde 1, als dauerhafter Fall: geliefert werden ausschliesslich die drei
    // Störer, nur in anderer Reihenfolge. Rot muss das sein — aber mit dem Grund, den das Ergebnis
    // hergibt. Eine Meldung, die hier „liefert ziel-deckt-alle-terme" behauptet, ist eine Erfindung.
    const defekt = ersetzen(
      vertrag,
      "return Promise.resolve(seite);",
      "return Promise.resolve([...seite].reverse());",
    );
    const fehler = await abgewiesen(pruefeAttrappe(defekt));
    expect(fehler).toMatch(
      /W6 Rangfolge: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts:\d+:/,
    );
    expect(fehler).toContain(`geliefert (${[...W6_STOERER].reverse().join(" → ")})`);
    expect(fehler).toContain(`erwartet (${W6_STOERER.join(" → ")})`);
    expect(fehler).toContain(`hält „${W6_ZIEL}" zwar draussen`);
    expect(fehler).not.toContain("RELEVANZBEWUSST");
    expect(fehler).not.toContain(`„${W6_ZIEL}" steht an Stelle`);
  });

  for (const [wo, verstellen] of SCHEINSTUFEN) {
    it(`W6 Kalibrierung: die Trefferzahl als ${wo} lässt W6 GRÜN — gemessen wird Verhalten`, async () => {
      const arbeitskopie = verstellen(TREFFERZAHL_ZUERST + REINE_RANGFOLGE);
      expect(arbeitskopie, "W6: die Kalibrierung erreicht den Vertrag nicht").not.toBe(vertrag);
      // Die echte Sortierstufe steht unverändert da: verstellt ist ausschliesslich blinder Text.
      expect(arbeitskopie).toContain(REINE_RANGFOLGE);
      await pruefeAttrappe(arbeitskopie);
    });
  }

  it("W6 Zustandsmodell: verlorene Attrappe ist rot mit Grund, nicht still grün", async () => {
    for (const [, einbetten] of FREMDTEXT) {
      const defekt =
        ersetzen(vertrag, "findCandidates(query: KoCandidateQuery)", "sucheKandidaten(query)") +
        einbetten("findCandidates(query) { return []; }");
      await expect(pruefeAttrappe(defekt)).rejects.toThrow(
        /Attrappe \(Funktion mit ausführbarem findCandidates\) fehlt\/mehrdeutig; gefunden: 0/,
      );
    }
  });

  it("W6 Zustandsmodell: eine ZWEITE Attrappe ist rot mit „gefunden: 2“ — derselbe Text blind nicht", async () => {
    // Die andere Hälfte der Meldung `fehlt/mehrdeutig`: bis JOB 3850 war ausschliesslich der
    // „fehlt"-Zweig (`gefunden: 0`) gemessen. Geprüft wird der VOLLSTÄNDIGE Wortlaut, nicht das
    // Vorkommen des Wortes „mehrdeutig" irgendwo in der Meldung.
    const fehler = await abgewiesen(pruefeAttrappe(`${vertrag}\n${ZWEITE_QUELLE}\n`));
    expect(fehler).toBe(
      `W5: ${VERTRAG}: Attrappe (Funktion mit ausführbarem findCandidates) fehlt/mehrdeutig; gefunden: 2`,
    );
    // Gegenrichtung im selben Fall: DIESELBE zweite Quelle als Kommentar, Stringliteral und
    // Falltitel. Der Filter misst Struktur, nicht Text — also bleibt W6 grün und `gefunden: 2`
    // tritt nicht ein. Ohne diese Hälfte belegte der Fall nur, dass irgendetwas rot wird.
    for (const [, einbetten] of FREMDTEXT) {
      const blind = vertrag + einbetten(ZWEITE_QUELLE);
      expect(blind, "W6: die Gegenrichtung erreicht den Vertrag nicht").not.toBe(vertrag);
      await pruefeAttrappe(blind);
    }
  });

  it("W6 Zustandsmodell: eine UMBENANNTE Attrappe bleibt sehend — neuer Name, neue Zeile", async () => {
    // Die Zusage aus dem Kopf von `attrappe()` (`:255`): „eine Umbenennung macht ihn nicht blind,
    // sondern lässt ihn weiter dieselbe Stelle prüfen." Der Bestand misst nur die VERBOTENE
    // Umbenennung (W5, `pgAehnlicherKoService`); ein harmloser neuer Name war ungemessen.
    const alt = attrappe(vertrag).name?.text ?? "";
    const neu = "bewusstSchwachDeckelndeQuelle";
    const umbenannt = vertrag.replaceAll(alt, neu);
    expect(umbenannt, "W6: die Umbenennung erreicht den Vertrag nicht").not.toBe(vertrag);
    expect(umbenannt).not.toContain(alt);
    // Grün bleibt sie — und zwar mit der VOLLSTÄNDIGEN Auskunft des Läufers, nicht bloss „grün".
    await pruefeAttrappe(umbenannt);
    const lauf = await fuehreAttrappeAus(umbenannt);
    expect(lauf.name, "W6: der gemeldete Name ist noch der alte").toBe(neu);
    expect(lauf.ort).toBe(zeileVon(umbenannt, VERTRAG, `function ${neu}`));
    expect(lauf.geliefert).toEqual([...W6_STOERER]);
    // Der alte Anker existiert nicht mehr: der gemeldete Ort ist wirklich am NEUEN Namen gebildet.
    expect(() => zeileVon(umbenannt, VERTRAG, `function ${alt}`)).toThrow(
      `${VERTRAG}: keine Zeile trägt „function ${alt}“`,
    );
  });

  it("W6 Zustandsmodell: eine werfende Attrappe ist rot mit dem gelesenen Ausschnitt", async () => {
    // Ohne erfolgreichen Lauf gibt es kein Urteil, sondern einen roten Fall — nie die negative
    // Aussage „keine Relevanzstufe vorhanden" auf der Grundlage eines Ausfalls.
    const defekt = ersetzen(vertrag, "bestand.filter((ko) => {", "nichtVorhanden((ko) => {");
    const name = attrappe(defekt).name?.text ?? "";
    const fehler = await abgewiesen(pruefeAttrappe(defekt));
    expect(fehler).toMatch(
      /W6: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts: die Attrappe lief nicht: ReferenceError/,
    );
    expect(fehler).toContain(`gelesener Ausschnitt: function ${name}`);
  });

  it("W6 Zustandsmodell: eine hängende Attrappe läuft ins Zeitlimit und ist rot mit Grund", async () => {
    // BEN Runde 1, „NICHT GEPRÜFT": das Zeitlimit war bis hier eine Zusage ohne Messung. Eine
    // Attrappe, die nicht zurückkommt, darf den Lauf weder hängen lassen noch still grün sein.
    const defekt = ersetzen(
      vertrag,
      "const seite = sortiert.slice(",
      "for (;;) {}\n      const seite = sortiert.slice(",
    );
    const name = attrappe(defekt).name?.text ?? "";
    const fehler = await abgewiesen(pruefeAttrappe(defekt));
    expect(fehler).toMatch(
      /W6: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts: die Attrappe lief nicht: Error: Script execution timed out/,
    );
    expect(fehler).toContain(`gelesener Ausschnitt: function ${name}`);
  });

  it("W6 Zustandsmodell: eine ASYNCHRON hängende Attrappe läuft in die EIGENE Frist", async () => {
    // JOB 3826 R2, BENs Prüfpunkt 6: „Asynchrones Hängen wurde nicht geprüft." Der Fall darüber ist
    // SYNCHRON und wird vom vm-Zeitlimit abgefangen — das greift ausschliesslich in der synchronen
    // Ausführung. Ein Promise, das nie auflöst, entkommt ihm vollständig: das vm-Skript kehrt sofort
    // zurück, gewartet wird danach im Testprozess. Bis JOB 3850 hing dort die ganze Datei.
    const defekt = ersetzen(
      vertrag,
      "return Promise.resolve(seite);",
      "return new Promise(() => {});",
    );
    const name = attrappe(defekt).name?.text ?? "";
    const fehler = await abgewiesen(pruefeAttrappe(defekt));
    expect(fehler).toMatch(/^W6: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts: /);
    expect(fehler).toContain(W6_FRIST_GRUND);
    expect(fehler).toContain(`gelesener Ausschnitt: function ${name}`);
    // Sonst wäre dieser Zweig nur zufällig rot — nämlich über den Grund des SYNCHRONEN Falls.
    expect(fehler).not.toContain("Script execution timed out");
  });

  it("W6 Zustandsmodell: mit NEUTRALEM Abschluss greift die ZWEITE Wartestelle (`await aufzeichnung.lauf`)", async () => {
    // JOB 3868 — BENs Prüfpunkt 6 zu 3850 (`archiv/3850/runde-1/ben.md:33`), wörtlich bestellt:
    // „Die zweite Wartestelle (`:993`) wird beim heutigen VM-Rückgabeverhalten nicht isoliert
    // kalibriert. Folgeprobe: VM-Rumpf mit neutralem Abschluss versehen und weiterhin ein offenes
    // Kandidaten-Promise erwarten." Dieselbe Verstellung wie im Fall darüber, nur der Rumpf endet
    // neutral: `runInNewContext` gibt dann nicht mehr das Kandidaten-Promise zurück, die erste
    // Wartestelle ist sofort durch, und allein die zweite kann noch warten. GEMESSEN: ohne die
    // Frist an dieser zweiten Stelle ist genau DIESER Fall rot und sonst keiner.
    // JOB 3894: die verstellte Zeile kommt aus `W6_RUECKGABE_ZEILE` — demselben Anker, den Fall B
    // liest. Eine Verstellung dort macht ab jetzt BEIDE Fälle rot statt nur einen.
    const defekt = ersetzen(vertrag, W6_RUECKGABE_ZEILE, "return new Promise(() => {});");
    const name = attrappe(defekt).name?.text ?? "";
    const fehler = await abgewiesen(pruefeAttrappe(defekt, VERTRAG, { neutralerAbschluss: true }));
    expect(fehler).toMatch(/^W6: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts: /);
    expect(fehler).toContain(W6_FRIST_GRUND);
    expect(fehler).toContain(`gelesener Ausschnitt: function ${name}`);
    // Trennung der Gründe: nicht das vm-Zeitlimit (synchron) und nicht „die Attrappe lief nicht".
    expect(fehler).not.toContain("Script execution timed out");
    expect(fehler).not.toContain("der neutrale Abschluss des VM-Rumpfs wurde nicht erreicht");
  });

  it("W6 Zustandsmodell: eine VERSPÄTET antwortende Attrappe ist rot an der ERSTEN Wartestelle — und ihre Antwort trifft DANACH wirklich ein", async () => {
    // JOB 3868 — die zweite Bestellung aus `ben.md:33` („Für verspätete Auflösung wäre ein eigener
    // Fall nach Fristablauf sinnvoll") und zugleich sein „NICHT GEPRÜFT" aus `:37`. Der Unterschied
    // zum Fall darüber: die Attrappe hängt NICHT, sie antwortet — nur zu spät, und mit einem sonst
    // völlig KORREKTEN Ergebnis. Genau deshalb wäre sie ohne Frist ein spätes, stilles Grün.
    // Die Wartestelle ist GEMESSEN und nicht angenommen: ohne neutralen Abschluss gibt der VM-Rumpf
    // das Kandidaten-Promise zurück, also greift die ERSTE Frist (um `fuehreGelesenAus`).
    // RUNDE 2, BENs Korrekturpflicht 1: Runde 1 löschte den Antwortzeitgeber gleich nach dem
    // Fristfehler und prüfte damit nur einen GEPLANTEN, nie einen EINGETRETENEN späten Abschluss.
    // Hier wird er abgewartet — erst der Fristfehler, dann die echte Antwort mit korrektem Ergebnis.
    const defekt = ersetzen(
      vertrag,
      W6_RUECKGABE_ZEILE,
      `return verzoegere(seite, ${W6_VERSPAETUNG_MS});`,
    );
    const name = attrappe(defekt).name?.text ?? "";
    expect(raeumeVerzoegerungen(), "W6: vor diesem Fall darf kein Zeitgeber offen sein").toBe(0);
    const fehler = await abgewiesen(pruefeAttrappe(defekt));
    w6Hergang.push(W6_HERGANG_FRIST);
    expect(fehler).toMatch(/^W6: tests\/ask\/ask-retrieval-topk-scaling-contract\.test\.ts: /);
    expect(fehler).toContain(W6_FRIST_GRUND);
    expect(fehler).toContain(`gelesener Ausschnitt: function ${name}`);
    expect(fehler).not.toContain("Script execution timed out");
    // Die Antwort steht in diesem Augenblick wirklich noch aus — der Zeitgeber der Attrappe läuft.
    expect(
      offeneVerzoegerungen(),
      `W6: die Verzögerung (${W6_VERSPAETUNG_MS} ms) war bei Fristablauf (${W6_FRIST_MS} ms) schon vorbei`,
    ).toBe(1);
    // DER NACHWEIS, den Runde 1 schuldig blieb: die verspätete Auflösung tritt danach WIRKLICH ein.
    // Mit eigener Obergrenze, damit ihr Ausbleiben ein roter Fall mit Grund ist und nicht Vitests
    // nacktes „Test timed out"; fehlt `aufloesen(wert)` in `verzoegere`, ist genau hier Schluss (R4).
    const spaeteAntwort = await mitFrist(
      letzteVerzoegerung().antwort,
      W6_NACHFRIST_MS,
      W6_NACHFRIST_GRUND,
    );
    // Die Reihenfolge wird GELESEN, nicht hergestellt: den Antworteintrag schreibt der Zeitgeber
    // selbst, im Augenblick seines Feuerns. Käme die Antwort zu früh, stünde sie hier vorn.
    expect(w6Hergang, "W6: die Antwort kam nicht NACH dem Fristfehler").toEqual([
      W6_HERGANG_FRIST,
      W6_HERGANG_ANTWORT,
    ]);
    // Und sie ist inhaltlich KORREKT — diese Attrappe war nie defekt, sie war nur zu spät. Genau
    // deshalb wäre sie ohne Frist ein spätes, stilles Grün gewesen.
    expect(
      Array.isArray(spaeteAntwort),
      `W6: die verspätete Antwort ist keine Liste: ${String(spaeteAntwort)}`,
    ).toBe(true);
    expect(
      Array.from(spaeteAntwort as readonly { readonly id?: unknown }[], (ko) => String(ko?.id)),
      "W6: die verspätete Antwort trägt nicht das sonst korrekte Ergebnis",
    ).toEqual([...W6_STOERER]);
    // Prozesshygiene: der Zeitgeber ist von SELBST abgelaufen, und es bleibt nichts für andere Fälle.
    expect(offeneVerzoegerungen(), "W6: nach der Antwort darf kein Zeitgeber mehr laufen").toBe(0);
    expect(raeumeVerzoegerungen(), "W6: das Abräumen findet nichts mehr vor").toBe(0);
  });

  // ==============================================================================================
  // JOB 3894 · W7 — DIE FÄLLE. Der Kopf dieser Wache steht oben bei `W7_ZEITGEBER`.
  // ==============================================================================================

  it("W7: jeder Zeitgeber DIESER Datei bekommt vor seiner ersten Verwendung `unref()`", () => {
    const beginn = Date.now();
    const stellen = zeitgeberstellen(selbst);
    // Eine Erhebung, die nichts gelesen hat, ist keine Entwarnung (`toter-kandidatenweg.test.ts:794`).
    expect(
      stellen.length,
      `W7: ${SELBST}: keine Zeitgeber-Anlegestelle gelesen — dieses Grün sagte dann nichts`,
    ).toBeGreaterThanOrEqual(W7_TRAEGER.length);
    // Beide heutigen Stellen sind wirklich darunter, und zwar als ENTHALTEN statt als Aufzählung:
    // eine dritte Anlegestelle soll W7 nicht hier scheitern lassen, sondern an ihrem fehlenden `unref`.
    expect(
      stellen.map((s) => s.traeger),
      `W7: ${SELBST}: eine der bewachten Anlegestellen ist nicht mehr da`,
    ).toEqual(expect.arrayContaining([...W7_TRAEGER]));
    expect(w7Befund(selbst), `W7: ${SELBST}: Zeitgeber ohne \`unref()\``).toEqual([]);
    // Jede Anlegestelle mit Namen muss ihre Deklaration wirklich gefunden haben — sonst urteilte W7
    // über eine Bindung, die es gar nicht gelesen hat.
    expect(
      stellen.filter((s) => s.name !== undefined && s.bindungsort === undefined),
      `W7: ${SELBST}: Zeitgeber ohne gelesenen Bindungsbereich`,
    ).toEqual([]);
    // Die Zahlen gehören in die Ausgabe: sonst ist nicht nachlesbar, WIE VIEL dieses Grün gedeckt hat.
    const aufgeloest = stellen.filter((s) => s.bindungsort !== undefined).length;
    const gelesen = stellen.map((s) => `${s.traeger}/${s.name ?? "ungebunden"}`).join(", ");
    process.stdout.write(
      `\nJOB 3894 — W7 gelesen: ${stellen.length} Zeitgeber-Anlegestellen in ${SELBST}, ` +
        `${aufgeloest} davon mit aufgelöster Bindung, 0 Beanstandungen (${gelesen})` +
        ` — Syntaxbaum mit Gültigkeitsbereichen, Erhebung ${Date.now() - beginn} ms.\n`,
    );
  });

  it("W7 Kalibrierung: eine DRITTE Anlegestelle ohne `unref` wird nicht durchgewunken", () => {
    // Ein Wächter, der nur die zwei ihm bekannten Zeilen kennt, ist eine Aufzählung und kein
    // Wächter. Die dritte Stelle gibt es heute nicht — sie wird gestellt, im Speicher.
    const mitDritter = `${selbst}\n${W7_DRITTE}\n`;
    expect(zeitgeberstellen(mitDritter).map((s) => s.traeger)).toEqual([
      ...W7_TRAEGER,
      "dritterZeitgeber",
    ]);
    const befund = w7Befund(mitDritter);
    expect(befund).toHaveLength(1);
    expect(befund[0]).toContain(
      "W7: dritterZeitgeber: `spaet` bekommt vor seiner ersten Verwendung kein `unref()`",
    );
    expect(befund[0]).toContain(`angelegt ${SELBST}:`);
    // Die Meldung nennt den GEFUNDENEN Text (hier das `clearTimeout`), nicht den gesuchten.
    expect(befund[0]).toContain("erste Verwendung");
    expect(befund[0]).toContain("clearTimeout(spaet)");
  });

  it("W7 Kalibrierung: ein umbenanntes `unref` an den ECHTEN Stellen macht beide rot", () => {
    // Die zweite Hälfte von R3: nicht eine fremde Stelle dazu, sondern die Zuordnung an den zwei
    // vorhandenen aufgelöst. Eine Zeichenkettensuche nach `.unref()` bliebe hier ebenso rot — aber
    // sie wäre es auch, wenn das `unref` auf der FALSCHEN Variablen stünde. W7 liest die Bindung.
    const umbenannt = selbst.replaceAll(".unref();", ".abmelden();");
    expect(umbenannt, "W7: die Kalibrierung erreicht den eigenen Quelltext nicht").not.toBe(selbst);
    const befund = w7Befund(umbenannt);
    expect(befund).toHaveLength(W7_TRAEGER.length);
    for (const [i, traeger] of W7_TRAEGER.entries()) {
      expect(befund[i]).toContain(
        `W7: ${traeger}: \`uhr\` bekommt vor seiner ersten Verwendung kein \`unref()\``,
      );
      expect(befund[i]).toContain("uhr.abmelden();");
    }
  });

  // BENs entscheidende Gegenprobe aus Runde 2 (Cloud-Lauf `a91faad9fdd675bbbf26e27c`), dauerhaft:
  // damals `Tests 57 passed (57)` und `0 Beanstandungen`, obwohl der Zeitgeber sein `unref()`
  // verloren hatte. Beide Überschattungsformen, an beiden echten Stellen — vier Verstellungen.
  for (const [form, fremd] of W7_FREMDE_BINDUNGEN) {
    for (const [traeger, anker] of W7_ECHTE_STELLEN) {
      it(`W7 Kalibrierung: gleicher Name, fremde Bindung (${form}) in \`${traeger}\` ist ROT`, () => {
        const verstellt = ersetzen(selbst, anker, anker.replace("uhr.unref();", fremd));
        // Der TEXT `.unref(` wird durch die Verstellung NICHT seltener: eine Zeichenkettensuche
        // sähe hier nichts und bliebe grün. Nur die gelesene Bindung trennt die beiden Fälle.
        expect(
          verstellt.split(".unref(").length,
          "W7: die Kalibrierung entfernt den Text `.unref(` — dann wäre schon eine Suche rot",
        ).toBeGreaterThanOrEqual(selbst.split(".unref(").length);
        const befund = w7Befund(verstellt);
        expect(befund, `W7: ${traeger}: die überschattete Bindung blieb unbemerkt`).toHaveLength(1);
        expect(befund[0]).toContain(
          `W7: ${traeger}: \`uhr\` bekommt vor seiner ersten Verwendung kein \`unref()\``,
        );
        expect(befund[0]).toContain(`angelegt ${SELBST}:`);
        // Die Meldung nennt die überschattende Stelle mit Datei und Zeile, nicht nur ein Fehlen.
        expect(befund[0]).toContain("der Name wird in einem inneren Bereich NEU gebunden");
        expect(befund[0]).toContain(fremd.slice(0, 24));
      });
    }
  }

  it("W7 Kalibrierung: ein `var`-Zeitgeber aus einem inneren Block bleibt GRÜN — `var` gilt funktionsweit", () => {
    // Die Gegenrichtung zu BENs `var`-Gegenprobe: hier gehört das spätere `unref()` dem Zeitgeber
    // WIRKLICH, weil `var spaetVar` für die ganze Funktion gilt. Wer `var` als Blockbindung liest,
    // sucht nur im `if`-Block, findet dort keine Verwendung und ist falsch rot.
    const mitVar = `${selbst}\n${W7_VAR_GRUEN}\n`;
    const stellen = zeitgeberstellen(mitVar);
    expect(stellen.map((s) => `${s.traeger}/${s.name}`)).toEqual([
      "mitFrist/uhr",
      "verzoegere/uhr",
      "varZeitgeber/spaetVar",
    ]);
    // Der gelesene Bindungsbereich ist die FUNKTION, nicht der `if`-Block — das ist der Kern.
    const varStelle = genauEins(
      stellen.filter((s) => s.name === "spaetVar"),
      "W7: die gestellte `var`-Anlegestelle wurde nicht gelesen",
    );
    expect(varStelle.bindungsort, "W7: `var` wurde nicht funktionsweit aufgelöst").toContain(
      "function varZeitgeber()",
    );
    expect(varStelle.ueberschattung, "W7: der eigene `var`-Block gilt als fremde Bindung").toEqual(
      [],
    );
    expect(
      w7Befund(mitVar),
      "W7: der funktionsweite `var`-Zeitgeber wurde falsch beanstandet",
    ).toEqual([]);
  });

  it("W7 Kalibrierung: ein `var`-Zeitgeber OHNE `unref` ist ROT — das Hochziehen macht keine blinde Stelle", () => {
    const mitVar = `${selbst}\n${W7_VAR_ROT}\n`;
    const befund = w7Befund(mitVar);
    expect(befund).toHaveLength(1);
    expect(befund[0]).toContain(
      "W7: varZeitgeberOhne: `ohneVar` bekommt vor seiner ersten Verwendung kein `unref()`",
    );
    // Der GEFUNDENE Text, nicht der gesuchte (Lehre JOB 3826 R1).
    expect(befund[0]).toContain("clearTimeout(ohneVar)");
  });

  it("W7 Kalibrierung: ein korrekt UMBENANNTER Zeitgeber bleibt GRÜN — geeicht ist die Bindung, nicht der Name `uhr`", () => {
    // Die Gegenrichtung zur Überschattung: ein Wächter, der nur den Namen `uhr` kennt, wäre hier
    // falsch rot — und eine falsch rote Wache wird abgeschaltet, nicht befolgt.
    const umbenannt = ersetzen(
      ersetzen(selbst, "const uhr = setTimeout(() => {", "const wecker = setTimeout(() => {"),
      W7_ECHT_VERZOEGERE,
      "  wecker.unref();\n  eintrag.uhr = wecker;",
    );
    const stellen = zeitgeberstellen(umbenannt);
    expect(stellen.map((s) => `${s.traeger}/${s.name}`)).toEqual([
      "mitFrist/uhr",
      "verzoegere/wecker",
    ]);
    expect(w7Befund(umbenannt), "W7: der umbenannte Zeitgeber wurde falsch beanstandet").toEqual(
      [],
    );
  });

  for (const [name, einbetten] of FREMDTEXT) {
    it(`W7 Kalibrierung: die dritte Anlegestelle als ${name} lässt W7 GRÜN — gelesen wird Struktur`, () => {
      const blind = selbst + einbetten(W7_DRITTE);
      expect(blind, "W7: die Kalibrierung erreicht den eigenen Quelltext nicht").not.toBe(selbst);
      const stellen = zeitgeberstellen(blind);
      // Der TEXT `setTimeout(` steht jetzt öfter da, als es Anlegestellen gibt — eine
      // Zeichenkettensuche zählte ihn mit und wäre hier falsch rot.
      expect(
        blind.split("setTimeout(").length - 1,
        "W7: die Kalibrierung braucht mehr Textfunde als Anlegestellen",
      ).toBeGreaterThan(stellen.length);
      expect(stellen.map((s) => s.traeger)).toEqual([...W7_TRAEGER]);
      expect(w7Befund(blind)).toEqual([]);
    });
  }

  // Beide Wortformen, und das ist kein Fleiß: mit `Produktionsadapters?` OHNE Wortgrenze nimmt der
  // Regexmotor beim Zurückgehen die Form ohne „s" und hält die EHRLICHE Stelle für offen — der
  // Wächter war damit in Runde 1 an genau dieser Stelle falsch rot (gemessen, nicht vermutet).
  for (const zusatz of [
    "Der Doppelgänger bildet die Rangfolge des Produktionsadapters exakt nach.",
    "Die Attrappe ist der Produktionsadapter, eins zu eins.",
  ]) {
    it(`W3 Fundstellen: zweite, schwächere Behauptung („${zusatz.slice(0, 28)}…“) ist rot`, async () => {
      await expect(pruefeVertrag(`${vertrag}\n// ${zusatz}\n`, pg)).rejects.toThrow(
        /W3 Fundstellen/,
      );
    });
  }

  it("W1 Zustandsmodell: fehlender Poolaufruf nennt Pfad und gelesene Methode", async () => {
    const defekt = ersetzen(pg, "await this.pool.query<DataRow>(sql, params)", "{ rows: [] }");
    await expect(pgRangfolge(defekt)).rejects.toThrow(
      /W1: services\/knowledge-object\/src\/repo-pg.ts: Kandidatenabfrage fehlt\/mehrdeutig; gelesener Ausschnitt: async findCandidates/,
    );
  });

  it("W1 Zustandsmodell: falscher Pfad ist rot mit Pfad und Ausschnitt", () => {
    expect(() => lesen(`${PG}.fehlt`)).toThrow(
      `${PG}.fehlt: Quelle nicht lesbar; gelesener Ausschnitt: <keiner>`,
    );
  });

  it("W1 Zustandsmodell: fehlende Methode ist rot trotz Stichwort in Kommentar/Literal/Falltitel", async () => {
    for (const [, einbetten] of FREMDTEXT) {
      const defekt =
        ersetzen(pg, "async findCandidates(", "async umgebaut(") +
        einbetten("async findCandidates(query) { ORDER BY trefferzahl }");
      await expect(pgRangfolge(defekt)).rejects.toThrow(
        /W1: services\/knowledge-object\/src\/repo-pg.ts: PgKoRepo.findCandidates nicht gefunden; gelesener Ausschnitt:/,
      );
    }
  });

  it("W1 Zustandsmodell: fehlendes ORDER BY nennt die gelesene SQL-Anweisung", async () => {
    const defekt = ersetzen(
      pg,
      "ORDER BY (${trefferzahl}) DESC, (status='validiert') DESC, (data->>'trust')::int DESC NULLS LAST LIMIT",
      "LIMIT",
    );
    await expect(pgRangfolge(defekt)).rejects.toThrow(/ORDER BY nicht gefunden; SQL: SELECT/);
  });
});
