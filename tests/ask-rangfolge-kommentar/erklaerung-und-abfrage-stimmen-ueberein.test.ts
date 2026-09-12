import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  const printer = ts.createPrinter({ removeComments: true });
  const drucke = (n: ts.Node): string => printer.printNode(ts.EmitHint.Unspecified, n, datei);
  const konstanten = ["KO_CANDIDATE_SEARCH", "KO_CANDIDATE_SEARCH_EXPRESSIONS"].map((name) => {
    const deklaration = datei.statements
      .filter(ts.isVariableStatement)
      .flatMap((n) => [...n.declarationList.declarations])
      .find((n) => ts.isIdentifier(n.name) && n.name.text === name);
    if (!deklaration?.initializer) throw fehler(`Suchfeld-Konstante ${name} nicht gefunden`);
    return `const ${name} = ${drucke(deklaration.initializer)};`;
  });
  const abfragen: string[] = [];
  const code = `${konstanten.join("\n")}
    class GelesenerAdapter { ${drucke(methode)} }
    const adapter = new GelesenerAdapter();
    adapter.pool = pool;
    adapter.findCandidates({ terms: ["ventil", "pumpe"], limit: 3 });`;
  try {
    await runInNewContext(
      ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
      {
        pool: {
          query(sql: string) {
            abfragen.push(sql);
            return Promise.resolve({ rows: [] });
          },
        },
      },
      { timeout: 1_000 },
    );
  } catch (error) {
    throw fehler(`Abfrage nicht lesbar: ${String(error)}; Methode: ${drucke(methode)}`);
  }
  const sql = genauEins(
    abfragen,
    `W1: ${pfad}: Kandidatenabfrage fehlt/mehrdeutig; gelesener Ausschnitt: ${drucke(methode)}`,
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
