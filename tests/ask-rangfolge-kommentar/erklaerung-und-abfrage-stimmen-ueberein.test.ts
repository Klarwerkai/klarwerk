import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  ausschnitt,
  maskiere,
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
async function pgRangfolge(text: string, pfad = PG): Promise<string[]> {
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
  if (bereiche.length === 0) throw fehler(`ORDER BY nicht gefunden; SQL: ${sql}`);
  return bereiche.map((bereich) => {
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
  const ranges = ts.getLeadingCommentRanges(text, knoten.getFullStart()) ?? [];
  return ranges
    .map((r) => text.slice(r.pos, r.end))
    .join("\n")
    .replace(/^\s*(?:\/\/ ?|\/\*\*?|\*\/|\* ?)/gm, "")
    .trim();
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

function behaupteteRangfolge(prosa: string, ort: string): string[] {
  const zeile = genauEins(
    prosa.split("\n").filter((z) => /^\s*· PgKoRepo(?:\.findCandidates)? sortiert /.test(z)),
    `${ort}: PgKoRepo-Aufzählung fehlt/mehrdeutig`,
  );
  const rang = /sortiert \(([^)]+)\)/.exec(zeile)?.[1];
  if (rang) return rang.split(",").map((s) => s.trim());
  // Auch den historischen SQL-Wortlaut verstehen: dessen Stufen widersprechen der heutigen
  // Abfrage inhaltlich. Nicht schon die andere Schreibweise soll den Vergleich abbrechen.
  const sql = /`(ORDER BY .+ LIMIT n)`/.exec(zeile)?.[1];
  if (!sql) throw new Error(`${ort}: keine Rangfolge gelesen: ${zeile}`);
  const maske = maskiere(sql);
  return sortierstufen(maske).map((bereich) => {
    const kern = ausschnitt(maske, stufenkern(maske, bereich));
    const name = kern === "(status='validiert')" ? "validiert" : kern === "trust" ? "Trust" : kern;
    return `${name} ${richtung(maske, bereich) === "desc" ? "↓" : "↑"}`;
  });
}

async function pruefeService(text: string, pg: string): Promise<void> {
  const gelesen = await pgRangfolge(pg);
  const prosa = kommentar(text, ASK, "ASK_PREFILTER_TERM_LIMIT");
  expect(
    behaupteteRangfolge(prosa, "W2"),
    `W2: ${PG}: gelesene Kette ${gelesen.join(" → ")}`,
  ).toEqual(gelesen);
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

async function pruefeVertrag(text: string, pg: string): Promise<void> {
  const kopf = kommentar(text, VERTRAG, "FRAGE");
  const befund = absatz(kopf, "HEUTE:", "W3 Befund");
  const gelesen = await pgRangfolge(pg);
  const rang = /PgKoRepo\.findCandidates sortiert \(([^)]+)\)/.exec(befund)?.[1];
  expect(
    rang?.split(",").map((s) => s.trim()),
    `W3 Befund: gelesene Kette ${gelesen.join(" → ")}`,
  ).toEqual(gelesen);
  const hinweis = befund.slice(befund.indexOf("Der Doppelgänger"));
  schwaechereQuelle(hinweis, "W3 Befund");
  schwaechereQuelle(absatz(kopf, "Der Doppelgänger", "W3 Erklärung"), "W3 Erklärung");
  const doc = kommentar(text, VERTRAG, "pgAehnlicherKoService");
  schwaechereQuelle(absatz(doc, "Der Doppelgänger", "W3 Docstring"), "W3 Docstring");
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
const FREMDTEXT = [
  ["Kommentar", (s: string) => `\n// ${s}\n`],
  ["Stringliteral", (s: string) => `\nconst scheinbeleg = ${JSON.stringify(s)};\n`],
  ["Falltitel", (s: string) => `\nit(${JSON.stringify(s)}, () => {});\n`],
] as const;

describe("JOB 3601: Erklärung und Abfrage stimmen überein", () => {
  it("W1 liest die gebaute ORDER BY-Kette aus der AST-Methode", async () => {
    const kette = await pgRangfolge(pg);
    expect(kette.length, `${PG}: leere Kette`).toBeGreaterThan(0);
  });

  it("W2 bindet die PgKoRepo-Erklärung an die gelesene Kette", async () => {
    await pruefeService(service, pg);
  });

  it("W3 bindet alle drei Vertragsstellen an die bewusst schwächere Quelle", async () => {
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
      expect(await pgRangfolge(arbeitskopie)).toEqual(["validiert ↓", "Trust ↓"]);
      expect(await pgRangfolge(arbeitskopie)).not.toEqual(await pgRangfolge(pg));
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

    it(`W4: Vertragshinweis als ${name} ersetzt keine der drei Stellen`, async () => {
      // Ausgangspunkt ist die echte Datei, nicht eine positive Ersatzfassung. Nach Red-first
      // trägt sie drei Hinweise; jede einzelne Entfernung muss den zugehörigen W3-Fall treffen.
      const stellen = [...vertrag.matchAll(new RegExp(HINWEIS, "g"))].map((m) => m.index);
      expect(stellen).toHaveLength(3);
      for (const pos of stellen) {
        const defekt = vertrag.slice(0, pos) + vertrag.slice(pos + HINWEIS.length);
        await expect(pruefeVertrag(defekt + einbetten(HINWEIS), pg)).rejects.toThrow(/W3/);
      }
    });
  }

  it("W4: bloße Gleichheitsbehauptung an jeder der drei Stellen ist rot", async () => {
    const stellen = [...vertrag.matchAll(new RegExp(HINWEIS, "g"))].map((m) => m.index);
    expect(stellen).toHaveLength(3);
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
