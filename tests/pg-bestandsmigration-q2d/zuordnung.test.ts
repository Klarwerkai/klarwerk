// ================================================================================================
// Q2d / JOB 3424 — WELCHE MIGRATION MIT „repo-pg.ts:116" GEMEINT IST, AM INHALT FESTGEMACHT.
// ================================================================================================
//
// Der Befund nennt eine Zeilennummer. Zeilennummern wandern; eine Prüfung, die sich an sie hängt,
// prüft nach dem nächsten Kommentar etwas anderes. Die Migration wird deshalb über das gefunden,
// was sie TUT: sie erkennt eine `external_id`-Spalte ohne `NULLIF`, wirft sie samt abhängigem
// Index ab und baut sie mit `NULLIF(data->'item'->>'externalId', '')` neu auf. Danach wird
// belegt, dass genau dieser Block heute in `IMPORT_CANDIDATES_SCHEMA` steht und dass diese Stufe
// auf dem echten Startweg `migrate()` läuft. Die Ausführung gegen PostgreSQL steht daneben in
// `bestandsmigration.integration.test.ts`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { schemas } from "../../services/app/src/db";
import { MIGRATIONS_SOLLLISTE } from "../../services/app/src/migrationsbeleg";
import { IMPORT_CANDIDATES_SCHEMA } from "../../services/library-analytics";

const QUELLE = readFileSync(
  new URL("../../services/library-analytics/src/repo-pg.ts", import.meta.url),
  "utf8",
);

/** Die drei Schritte der Heilung, wie sie im Quelltext stehen — die Funktion, nicht die Zeile. */
const HEILUNG =
  /DO \$\$\s+DECLARE\s+alt_expr text;[\s\S]*?a\.attname = 'external_id'[\s\S]*?alt_expr NOT ILIKE '%NULLIF%'[\s\S]*?ALTER TABLE import_candidates DROP COLUMN external_id CASCADE;\s+ALTER TABLE import_candidates\s+ADD COLUMN external_id text\s+GENERATED ALWAYS AS \(NULLIF\(data->'item'->>'externalId', ''\)\) STORED;\s+END IF;\s+END \$\$;/g;

function konstanteImQuelltext(): { anfang: number; ende: number } {
  const kopf = "export const IMPORT_CANDIDATES_SCHEMA = `";
  const anfang = QUELLE.indexOf(kopf);
  const ende = QUELLE.indexOf("`;", anfang + kopf.length);
  if (anfang < 0 || ende < 0) {
    throw new Error("IMPORT_CANDIDATES_SCHEMA ist in repo-pg.ts nicht auffindbar.");
  }
  return { anfang, ende };
}

describe("Q2d · Zuordnung der Bestandsmigration über Funktion und Inhalt", () => {
  it("Z1 · die Heilung steht GENAU EINMAL im Quelltext, und zwar in IMPORT_CANDIDATES_SCHEMA", () => {
    const treffer = [...QUELLE.matchAll(HEILUNG)];
    expect(treffer, "Die Heilung von external_id muss genau einmal vorkommen.").toHaveLength(1);
    const { anfang, ende } = konstanteImQuelltext();
    const stelle = treffer[0]?.index ?? -1;
    expect(stelle).toBeGreaterThan(anfang);
    expect(stelle).toBeLessThan(ende);
  });

  it("Z2 · die exportierte Konstante trägt dieselbe Heilung (was läuft, ist was geprüft wird)", () => {
    expect([...IMPORT_CANDIDATES_SCHEMA.matchAll(HEILUNG)]).toHaveLength(1);
    // Die Erstanlage nimmt dieselbe Expression — Neuinstallationen brauchen keine Heilung.
    expect(IMPORT_CANDIDATES_SCHEMA).toMatch(
      /ADD COLUMN IF NOT EXISTS external_id text\s+GENERATED ALWAYS AS \(NULLIF\(data->'item'->>'externalId', ''\)\) STORED;/,
    );
  });

  it("Z3 · die Stufe läuft auf dem echten Startweg migrate() und ist als IRREVERSIBEL geführt", () => {
    expect(schemas.filter((ddl) => ddl === IMPORT_CANDIDATES_SCHEMA)).toHaveLength(1);
    expect(MIGRATIONS_SOLLLISTE.find((s) => s.stufe === "IMPORT_CANDIDATES_SCHEMA")?.risiko).toBe(
      "IRREVERSIBEL",
    );
  });
});
