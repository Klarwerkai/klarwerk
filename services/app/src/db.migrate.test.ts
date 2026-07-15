import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
