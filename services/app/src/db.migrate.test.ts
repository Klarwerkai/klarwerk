import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KO_SEARCH_PROJECTION_SCHEMA, KO_SICHTBARKEIT_SCHEMA } from "../../knowledge-object";
import {
  IRREVERSIBLE_DATENMIGRATIONEN,
  MIGRATIONS_SOLLLISTE,
  erzeugeStrukturbeleg,
  istStrukturstufe,
  klassifiziereStufe,
} from "./migrationsbeleg";

// SCRUM-496 (die Lehre): Auf Postgres brach /duplikate ab, weil OVERLAP_SCHEMA + OVERLAP_SETTINGS_SCHEMA
// zwar existierten, aber NIE in migrate() aufgenommen wurden → die Tabellen fehlten (nur PG; In-Memory
// braucht kein Schema). Dieser Test fängt genau diese Klasse ab: JEDE exportierte DDL-*_SCHEMA-Konstante
// der Module MUSS in der migrate()-Liste (services/app/src/db.ts) referenziert sein. Läuft im Root-Gate
// (rein statisch, keine echte DB) — ein vergessenes Modul-Schema fällt damit künftig sofort auf.

const SERVICES_DIR = "services";
const DB_FILE = "services/app/src/db.ts";

// Alle .ts-Quellen der Module (ohne node_modules, ohne Tests).
function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

// Exportierte DDL-Schema-Konstanten — keine JSON-/Validierungs-„SCHEMA"-Konstanten ohne Tabelle.
//
// JOB 727 D2: Die Auswahl fragte bis hierher nur nach `CREATE TABLE`. Eine reine ALTER-Stufe fiel
// dadurch schweigend durch. `istStrukturstufe` fragt jetzt nach beidem und trifft damit die
// `schemas`-Liste genau.
//
// JOB 498 D8: mit `AUDIT_HASH_VERSION_SCHEMA` sind es FÜNF reine ALTER-Stufen, und die Menge
// umfasst 34 statt 33 Konstanten. Die Zahlen stehen hier, weil sie sonst still veralten.
function exportedDdlSchemas(): string[] {
  const names = new Set<string>();
  const re = /export const (\w+_SCHEMA)\s*=\s*`([\s\S]*?)`/g;
  for (const file of walkTsFiles(SERVICES_DIR)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(re)) {
      const [, name, body] = m;
      if (name && body && istStrukturstufe(body)) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

// Der Quelltext einer Schemakonstante, so wie er wirklich ausgeführt wird — für die Klassifikation.
function ddlVon(name: string): string {
  const re = new RegExp(`export const ${name}\\s*=\\s*\`([\\s\\S]*?)\``);
  for (const file of walkTsFiles(SERVICES_DIR)) {
    const treffer = re.exec(readFileSync(file, "utf8"));
    if (treffer?.[1]) {
      return treffer[1];
    }
  }
  return "";
}

// Die Kennungen der `schemas`-Liste in ihrer AUSGEFÜHRTEN Reihenfolge (nicht sortiert — die
// Reihenfolge ist Vertragsbestandteil, s. db.ts:62-67).
function migrateSchemaNamen(): string[] {
  return [...migrateSchemaList().matchAll(/\b([A-Z][A-Z0-9_]*_SCHEMA)\b/g)]
    .map((m) => m[1] as string)
    .filter((name, i, alle) => alle.indexOf(name) === i);
}

// Der Inhalt der `schemas`-Liste in migrate() (die tatsächlich ausgeführten DDLs).
function migrateSchemaList(): string {
  const src = readFileSync(DB_FILE, "utf8");
  const start = src.indexOf("const schemas = [");
  expect(start, "schemas-Liste in db.ts nicht gefunden").toBeGreaterThanOrEqual(0);
  const end = src.indexOf("];", start);
  expect(end, "Ende der schemas-Liste in db.ts nicht gefunden").toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("SCRUM-496: migrate() deckt alle Modul-DDL-Schemas ab", () => {
  it("jede exportierte DDL-*_SCHEMA-Konstante ist in migrate() referenziert", () => {
    const schemas = exportedDdlSchemas();
    // Absicherung: der Scanner findet überhaupt etwas (sonst wäre der Test wertlos).
    expect(schemas.length).toBeGreaterThanOrEqual(15);
    const list = migrateSchemaList();
    const missing = schemas.filter((name) => !new RegExp(`\\b${name}\\b`).test(list));
    expect(missing, `nicht migrierte DDL-Schemas: ${missing.join(", ")}`).toEqual([]);
  });

  it("die conflicts-Tabellen (SCRUM-496) sind explizit migriert", () => {
    const list = migrateSchemaList();
    for (const name of ["CONFLICTS_SCHEMA", "OVERLAP_SCHEMA", "OVERLAP_SETTINGS_SCHEMA"]) {
      expect(list.includes(name), `${name} fehlt in migrate()`).toBe(true);
    }
  });
});

// ================================================================================================
// G27 WELLE 1 / DETAILENTSCHEIDUNG J — DIE V1→V2-STUFE WIRD WIRKLICH AUSGEFÜHRT
// ================================================================================================
//
// DIESELBE FEHLERKLASSE WIE SCRUM-496, EINE STUFE TIEFER. Dort existierte eine DDL, die niemand
// ausführte. Hier könnte eine NACHRÜSTSTUFE existieren, die niemand ausführt: eine Migration, die
// als eigene Konstante neben dem CREATE-TABLE-Schema liegt und in der `schemas`-Liste vergessen
// wird, ist gegen eine Bestandsumgebung genau so wirkungslos wie eine fehlende Tabelle — nur fällt
// es später auf, nämlich erst beim ersten Insert gegen das unmigrierte Schema.
//
// Der Schutz ist deshalb doppelt: die Stufe steht IM ausgeführten Schema-String (sie kann gar nicht
// getrennt vergessen werden), und diese Prüfung pinnt genau das.
describe("G27 Welle 1 (Abschnitt J): die additive V1→V2-Stufe der Suchprojektion läuft in migrate()", () => {
  it("die Nachrüststufe steht im migrierten Schema-String — nicht in einer zweiten, freien Konstante", () => {
    expect(migrateSchemaList()).toContain("KO_SEARCH_PROJECTION_SCHEMA");
    expect(KO_SEARCH_PROJECTION_SCHEMA).toMatch(
      /ADD COLUMN IF NOT EXISTS\s+body_text\s+text NOT NULL DEFAULT ''/i,
    );
    expect(KO_SEARCH_PROJECTION_SCHEMA).toMatch(
      /ADD COLUMN IF NOT EXISTS\s+classification_snapshot\s+text NOT NULL DEFAULT ''/i,
    );
  });

  it("die Suchprojektion wird NACH dem KO-Schema migriert (pg_trgm und `kos` müssen stehen)", () => {
    const list = migrateSchemaList();
    expect(list.indexOf("KO_SCHEMA")).toBeGreaterThanOrEqual(0);
    expect(list.indexOf("KO_SEARCH_PROJECTION_SCHEMA")).toBeGreaterThan(list.indexOf("KO_SCHEMA"));
  });
});

// ================================================================================================
// AUFTRAG-BASIC-380 · T-M-3 — DIE VIERTE ALTER-ONLY-STUFE BRAUCHT IHREN EIGENEN PIN.
// ================================================================================================
//
// DIE GEMESSENE LÜCKE IM WÄCHTER (BASIC 379 §2.5, hier nachgemessen): `exportedDdlSchemas()` oben
// sammelt nur *_SCHEMA-Konstanten, DEREN TEMPLATE EIN `CREATE TABLE` TRÄGT. Eine reine
// ALTER-Stufe fällt durch dieses Netz — sie ist exportiert, sie sieht aus wie ein Schema, und der
// generische Test übersieht sie schweigend. Drei solche Stufen gab es bereits
// (KO_IMPORT_ANCHOR_SCHEMA, KO_CREATE_OPERATION_SCHEMA, AUDIT_EVENT_ID_SCHEMA); sie hängen alle an
// eigens benannten Prüfungen. KO_SICHTBARKEIT_SCHEMA ist die vierte, AUDIT_HASH_VERSION_SCHEMA
// (JOB 498 D8) die fünfte — letztere hängt am Inventurfall weiter unten und braucht deshalb
// keinen eigens geschriebenen Einzelfall mehr. Genau dafür wurde er gebaut.
//
// DAS IST DIESELBE FEHLERKLASSE WIE SCRUM-496, nur eine Stufe tiefer — und sie ist hier
// SICHERHEITSRELEVANT: fehlt die Stufe gegen eine Bestandsdatenbank, fehlen die Schlüsselspalten,
// und der SQL-Trim (services/app/src/sichtbarkeit.ts, sqlSichtbarkeitFuer) läuft in einen
// Datenbankfehler statt in eine getrimmte Menge. Fail-closed ist das zwar, aber es ist ein
// Betriebsausfall, den ein Test verhindern kann und deshalb verhindern soll.
describe("BASIC 380 (T-M-3): die ALTER-only-Stufe KO_SICHTBARKEIT_SCHEMA läuft wirklich in migrate()", () => {
  it("sie steht in der ausgeführten schemas-Liste — der generische Wächter fängt sie NICHT", () => {
    // Der Nachweis, dass der generische Wächter sie wirklich nicht sieht: sie trägt kein CREATE TABLE.
    expect(KO_SICHTBARKEIT_SCHEMA).not.toMatch(/CREATE TABLE/i);
    expect(migrateSchemaList()).toContain("KO_SICHTBARKEIT_SCHEMA");
  });

  it("sie legt genau die drei Schlüsselspalten des Trims an — generiert, nicht geschrieben", () => {
    for (const spalte of ["confidentiality_key", "author_key", "deleted_at_key"]) {
      expect(KO_SICHTBARKEIT_SCHEMA).toMatch(
        new RegExp(`ADD COLUMN IF NOT EXISTS\\s+${spalte}\\s+text\\s+GENERATED ALWAYS AS`, "i"),
      );
    }
  });

  it("die Stufengrenze ist ZEICHENGENAU normalizeConfidentiality — keine zweite Auslegung", () => {
    // confidentiality.ts:15-17: alles außer 'vertraulich'/'streng_vertraulich' ist 'intern'.
    expect(KO_SICHTBARKEIT_SCHEMA).toContain("'vertraulich'");
    expect(KO_SICHTBARKEIT_SCHEMA).toContain("'streng_vertraulich'");
    expect(KO_SICHTBARKEIT_SCHEMA).toContain("ELSE 'intern'");
  });

  it("sie wird NACH dem KO-Schema migriert (`kos` muss stehen, bevor daran geALTERt wird)", () => {
    const list = migrateSchemaList();
    expect(list.indexOf("KO_SICHTBARKEIT_SCHEMA")).toBeGreaterThan(list.indexOf("KO_SCHEMA"));
  });

  it("sie ist additiv: kein DROP TABLE, kein TRUNCATE, keine Änderung an kos.data", () => {
    expect(KO_SICHTBARKEIT_SCHEMA).not.toMatch(/DROP TABLE/i);
    expect(KO_SICHTBARKEIT_SCHEMA).not.toMatch(/TRUNCATE/i);
    expect(KO_SICHTBARKEIT_SCHEMA).not.toMatch(/UPDATE\s+kos/i);
    expect(KO_SICHTBARKEIT_SCHEMA).not.toMatch(/DELETE\s+FROM/i);
  });
});

// ================================================================================================
// JOB 727 D2 — DIE FILTERLÜCKE SELBST, NICHT NUR IHRE EINZELFÄLLE.
// ================================================================================================
//
// T-M-3 oben sichert EINE ALTER-only-Stufe mit einem eigens geschriebenen Fall. Das ist richtig und
// bleibt. Es skaliert nur nicht: für jede weitere Stufe braucht es wieder einen Menschen, der die
// Lücke kennt. Der Kommentar bei :114-116 behauptete deshalb eine Abdeckung, die es nicht gab —
// BASIC4 727/D1 §3.3 hat das nachgemessen, BEN hat es bestätigt.
//
// DIESER FALL PRÜFT DIE INVENTUR STATT DER EINZELSTUFE. Er ist rot, solange `exportedDdlSchemas()`
// auf `CREATE TABLE` filtert — und er bleibt grün, ohne dass jemand ihn anfasst, wenn eine fünfte
// ALTER-only-Stufe dazukommt.
//
// JOB 498 D8: DIE FÜNFTE STUFE IST DER BEWEIS, DASS DIESER FALL WIRKLICH MITWÄCHST.
// `AUDIT_HASH_VERSION_SCHEMA` ist genau der Fall, für den er geschrieben wurde: eine reine
// ALTER-Stufe, die der alte `CREATE TABLE`-Filter schweigend übersehen hätte.
const ALTER_ONLY_STUFEN = [
  "AUDIT_EVENT_ID_SCHEMA",
  "AUDIT_HASH_VERSION_SCHEMA",
  "KO_CREATE_OPERATION_SCHEMA",
  "KO_IMPORT_ANCHOR_SCHEMA",
  "KO_SICHTBARKEIT_SCHEMA",
] as const;

describe("JOB 727 D2: die Strukturinventur hat keine CREATE-TABLE-Filterlücke", () => {
  it("jede ALTER-only-Stufe der schemas-Liste steht in der Inventur", () => {
    const inventur = exportedDdlSchemas();
    for (const name of ALTER_ONLY_STUFEN) {
      expect(
        inventur,
        `${name} fehlt in der Inventur — der Scanner filtert auf CREATE TABLE und übersieht reine ALTER-Stufen schweigend`,
      ).toContain(name);
    }
  });

  it("die fünf ALTER-only-Stufen tragen wirklich kein CREATE TABLE — sonst prüfte der Fall nichts", () => {
    // Die Gegenkontrolle zum Fall darüber: wären sie CREATE-TABLE-Stufen, hätte der alte Filter
    // sie ohnehin gesehen und der Nachweis wäre leer.
    for (const name of ALTER_ONLY_STUFEN) {
      expect(ddlVon(name), `${name} nicht auffindbar`).not.toBe("");
      expect(ddlVon(name), `${name} trägt doch ein CREATE TABLE`).not.toMatch(/CREATE\s+TABLE/i);
      expect(istStrukturstufe(ddlVon(name)), `${name} gilt nicht als Strukturstufe`).toBe(true);
    }
  });
});

// ================================================================================================
// JOB 727 D2 — DIE SOLLLISTE IST IN BEIDE RICHTUNGEN GEBUNDEN.
// ================================================================================================
//
// BEN 727/D1 hat gerügt, dass die destruktive Menge unvollständig erhoben war: `IMPORT_CANDIDATES_
// SCHEMA` trägt `DROP COLUMN ... CASCADE`, eine dedupliziernde `DELETE FROM` und zwei `DROP INDEX`
// — in D1 stand, `KO_CREATE_OPERATION_SCHEMA` sei die einzige nicht-additive Stelle. Diese Fälle
// stellen das fest und halten es fest.
describe("JOB 727 D2: die ausgeschriebene Sollliste deckt die ausgeführte Liste — beidseitig", () => {
  it("keine ausgeführte Stufe fehlt in der Sollliste, und keine Sollstufe ist überzählig", () => {
    const ausgefuehrt = migrateSchemaNamen();
    const soll = MIGRATIONS_SOLLLISTE.map((s) => s.stufe);
    expect(
      soll.filter((s) => !ausgefuehrt.includes(s)),
      "in der Sollliste, aber nicht in migrate()",
    ).toEqual([]);
    expect(
      ausgefuehrt.filter((s) => !soll.includes(s)),
      "in migrate(), aber nicht in der Sollliste",
    ).toEqual([]);
  });

  it("die Sollliste steht in der ausgeführten Reihenfolge — sie ist Vertragsbestandteil", () => {
    expect(MIGRATIONS_SOLLLISTE.map((s) => s.stufe)).toEqual(migrateSchemaNamen());
  });

  it("jede Stufe trägt genau die Risikoklasse, die ihr Quelltext hergibt", () => {
    for (const { stufe, risiko } of MIGRATIONS_SOLLLISTE) {
      const ddl = ddlVon(stufe);
      expect(ddl, `${stufe} nicht auffindbar`).not.toBe("");
      expect(
        klassifiziereStufe(ddl),
        `${stufe}: die Sollliste sagt ${risiko}, der Quelltext sagt etwas anderes — eine Stufe hat still ihr Risiko geändert`,
      ).toBe(risiko);
    }
  });

  it("die beiden nicht-additiven Stufen sind namentlich benannt — nicht als Menge behauptet", () => {
    const nichtAdditiv = MIGRATIONS_SOLLLISTE.filter((s) => s.risiko !== "ADDITIV").map(
      (s) => s.stufe,
    );
    expect(nichtAdditiv).toEqual(["KO_CREATE_OPERATION_SCHEMA", "IMPORT_CANDIDATES_SCHEMA"]);
  });

  it("IMPORT_CANDIDATES_SCHEMA trägt alle drei Befunde aus BEN 727/D1", () => {
    const ddl = ddlVon("IMPORT_CANDIDATES_SCHEMA");
    expect(ddl).toMatch(/DROP\s+COLUMN\s+source_version\s+CASCADE/i);
    expect(ddl).toMatch(/DELETE\s+FROM\s+import_candidates/i);
    expect(ddl.match(/DROP\s+INDEX/gi)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(klassifiziereStufe(ddl)).toBe("IRREVERSIBEL");
  });

  it("migrateAuthTokensAtRest ist als irreversibel geführt — Ausklammern beseitigt das Risiko nicht", () => {
    const eintrag = IRREVERSIBLE_DATENMIGRATIONEN.find(
      (m) => m.stufe === "migrateAuthTokensAtRest",
    );
    expect(eintrag, "die Datenmigration fehlt in der Inventur").toBeDefined();
    expect(eintrag?.risiko).toBe("IRREVERSIBEL");
    // Sie steht wirklich im Startvorgang, direkt nach migrate() — sonst wäre der Eintrag Theorie.
    const server = readFileSync("services/app/src/server.ts", "utf8");
    expect(server).toContain("migrateAuthTokensAtRest");
    // Und ihr Quelltext trägt wirklich, was der Eintrag behauptet.
    const auth = readFileSync("services/auth/src/repo-pg.ts", "utf8");
    expect(auth).toMatch(/DELETE\s+FROM\s+sessions/i);
    expect(auth).toMatch(/UPDATE\s+\$\{table\}\s+SET\s+token/i);
  });

  it("der Beleg ist deterministisch und trägt Kennung, Reihenfolge, Quellhash und Risiko", () => {
    const eingaben = MIGRATIONS_SOLLLISTE.map((s) => ({ stufe: s.stufe, ddl: ddlVon(s.stufe) }));
    const a = erzeugeStrukturbeleg(eingaben);
    const b = erzeugeStrukturbeleg(eingaben);
    expect(a.beleghash).toBe(b.beleghash);
    expect(a.stufen).toHaveLength(MIGRATIONS_SOLLLISTE.length);
    expect(a.stufen[0]?.ordinal).toBe(0);
    expect(a.stufen.map((s) => s.stufe)).toEqual(migrateSchemaNamen());
    expect(a.hoechstesRisiko).toBe("IRREVERSIBEL");
    for (const stufe of a.stufen) {
      expect(stufe.quellhash, `${stufe.stufe} ohne Quellhash`).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
