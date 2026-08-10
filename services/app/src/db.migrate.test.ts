import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KO_SEARCH_PROJECTION_SCHEMA, KO_SICHTBARKEIT_SCHEMA } from "../../knowledge-object";

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

// Exportierte DDL-Schema-Konstanten (nur solche, deren Template ein CREATE TABLE trägt — keine
// JSON-/Validierungs-„SCHEMA"-Konstanten ohne Tabelle).
function exportedDdlSchemas(): string[] {
  const names = new Set<string>();
  const re = /export const (\w+_SCHEMA)\s*=\s*`([\s\S]*?)`/g;
  for (const file of walkTsFiles(SERVICES_DIR)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(re)) {
      const [, name, body] = m;
      if (name && body && /CREATE TABLE/i.test(body)) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
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
// generische Test übersieht sie schweigend. Drei solche Stufen gibt es bereits
// (KO_IMPORT_ANCHOR_SCHEMA, KO_CREATE_OPERATION_SCHEMA, AUDIT_EVENT_ID_SCHEMA); sie hängen alle an
// eigens benannten Prüfungen. KO_SICHTBARKEIT_SCHEMA ist die vierte.
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
