// ================================================================================================
// JOB 3424 (Q2d) — DIE EINE FRAGE, ZWEI ORTE, EINE ANTWORT.
// ================================================================================================
//
// Der Anker-Strang stellt genau EINE Frage: „Belegt dieses Item einen offenen Idempotenzplatz?"
// Beantwortet wird sie an zwei Orten, und beide müssen dasselbe sagen:
//
//   · JAVASCRIPT — `sameOpenCandidateSource` (`services/library-analytics/src/repo.ts`), zugleich
//     die Regel, nach der `service.ts` zwischen plain `insert` und idempotentem `insertIfAbsent`
//     entscheidet. Sie fragt über den Wahrheitswert: `""` ist KEIN Anker.
//   · POSTGRES — der partielle UNIQUE-Index in `IMPORT_CANDIDATES_SCHEMA` mit dem Prädikat
//     `external_id IS NOT NULL` über einer GENERATED-Spalte.
//
// Für `""` liefen beide auseinander: `->>` gibt für die leere JSON-Zeichenkette `''` zurück, nicht
// NULL — der Index galt für eine Zeile, die über den plain `insert` (ohne `ON CONFLICT`) kam.
//
// WAS DIESE DATEI KANN UND WAS NICHT — die Grenze steht hier, damit sie niemand für mehr hält:
// die JS-Seite wird AUSGEFÜHRT (echte Funktion, echte Kandidaten). Die SQL-Seite ist in dieser
// Bahn nicht ausführbar (kein Docker, keine Postgres-Instanz), sie wird darum an der DDL-Zeichen-
// kette GELESEN. Der ausführbare Beweis gegen einen echten Server steht in
// `pg-leere-kennung.integration.test.ts` (Lauf `test:integration`); er überspringt sich ehrlich,
// solange keine Instanz da ist. Dieser Wächter hier hält fest, dass niemand die Deckung
// unbemerkt wieder aufhebt.
import { describe, expect, it } from "vitest";
import {
  IMPORT_CANDIDATES_SCHEMA,
  type ImportCandidate,
  type ImportItem,
  sameOpenCandidateSource,
} from "../../services/library-analytics";

function kandidat(id: string, over: Partial<ImportItem>): ImportCandidate {
  const item: ImportItem = {
    title: "Ventil entlueften",
    statement: "Bei Ueberdruck das Ventil X langsam entlueften",
    type: "best_practice",
    category: "Wartung",
    sourceVersion: 1,
    provider: "Confluence",
    ...over,
  };
  return { id, item, status: "neu", duplicate: false, note: null, koId: null, createdAt: id };
}

/** Die Definitionszeile der GENERATED-Spalte `external_id` aus der echten DDL. */
function externalIdSpalte(): string {
  const treffer = IMPORT_CANDIDATES_SCHEMA.match(
    /ADD COLUMN(?: IF NOT EXISTS)? external_id text\s+GENERATED ALWAYS AS \(([^\n]*)\) STORED/,
  );
  if (!treffer?.[1]) {
    throw new Error("Die GENERATED-Definition von external_id ist in der DDL nicht auffindbar.");
  }
  return treffer[1];
}

describe("JOB 3424 · Q2d — der Anker-Vertrag zwischen Code und Index", () => {
  // ==============================================================================================
  // A1 — DIE JS-SEITE, AUSGEFÜHRT.
  // ==============================================================================================
  it("A1 · zwei Kandidaten mit leerer Kennung belegen KEINEN gemeinsamen Platz", () => {
    expect(
      sameOpenCandidateSource(kandidat("a", { externalId: "" }), kandidat("b", { externalId: "" })),
      "Eine leere Kennung ist kein Anker — sonst wäre der zweite Kandidat stumm verschwunden.",
    ).toBe(false);
  });

  it("A1b · eine GEFÜLLTE Kennung belegt weiterhin einen gemeinsamen Platz", () => {
    expect(
      sameOpenCandidateSource(
        kandidat("a", { externalId: "p1" }),
        kandidat("b", { externalId: "p1" }),
      ),
      "Ohne diesen Fall prüfte A1 nur, dass die Funktion immer false sagt.",
    ).toBe(true);
  });

  // ==============================================================================================
  // A2 — DIE SQL-SEITE, GELESEN. Genau hier lag die Abweichung, und genau hier kann sie zurückkommen.
  // ==============================================================================================
  it("A2 · die GENERATED-Spalte external_id bildet die leere Kennung auf NULL ab", () => {
    const definition = externalIdSpalte();
    expect(
      definition,
      "Ohne NULLIF liefert `->>` für \"\" ein '' — dann greift `external_id IS NOT NULL` für eine Zeile, die der Dienst über den plain insert einliefert.",
    ).toMatch(/NULLIF\(\s*data->'item'->>'externalId'\s*,\s*''\s*\)/);
  });

  it("A2b · das Index-Prädikat hängt unverändert an `external_id IS NOT NULL`", () => {
    // Ohne diesen Fall prüfte A2 eine Zutat, deren Wirkung niemand mehr belegt.
    expect(IMPORT_CANDIDATES_SCHEMA).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS import_candidates_open_claim_external_uq\s+ON import_candidates \(provider, external_id, source_version\)\s+WHERE external_id IS NOT NULL/,
    );
  });

  // ==============================================================================================
  // A3 — DIE BESTANDSINSTANZEN. `ADD COLUMN IF NOT EXISTS` ist auf einer vorhandenen Spalte ein
  // stilles No-op: ohne Heilung bekäme eine laufende Instanz die neue Expression NIE.
  // ==============================================================================================
  it("A3 · die DDL heilt eine Altspalte ohne NULLIF, statt sie stillschweigend stehen zu lassen", () => {
    expect(IMPORT_CANDIDATES_SCHEMA).toMatch(/attname = 'external_id'/);
    expect(IMPORT_CANDIDATES_SCHEMA).toMatch(/NOT ILIKE '%NULLIF%'/);
    expect(IMPORT_CANDIDATES_SCHEMA).toMatch(
      /ALTER TABLE import_candidates DROP COLUMN external_id CASCADE/,
    );
  });
});
