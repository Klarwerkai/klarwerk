// ================================================================================================
// JOB 4151 · TEST 3 — EIN FALLSATZ, ZWEI FASSUNGEN. HIER LÄUFT DIE ERSTE.
// ================================================================================================
//
// Der Fallsatz selbst steht in `bestandsvertrag.ts` und wird von GENAU ZWEI Dateien gefahren:
// hier gegen `DeduplizierenderKantenBestand` (im Tor, ohne Infrastruktur) und in
// `bestand-postgres.integration.test.ts` gegen `PgKantenRepo` (auf dem Prüfplatz, gegen ein echtes
// Postgres über Testcontainers).
//
// WARUM ZWEI DATEIEN UND NICHT EINE. Der Postgres-Fahrer braucht einen laufenden Docker-Daemon;
// `vitest.config.ts:31` schliesst `**/*.integration.test.ts` aus dem Torlauf deshalb ausdrücklich
// aus. Beide Fahrer in EINE Datei zu legen hiesse, entweder das ganze Tor an Docker zu binden oder
// die Postgres-Hälfte zur Laufzeit zu ÜBERSPRINGEN — und ein stilles `skip` ist genau die Sorte
// Grün, gegen die dieser Auftrag gebaut ist.
//
// WAS STATTDESSEN HIER STEHT (V7): der Pin auf die Anwesenheit des zweiten Fahrers. Verschwindet er
// oder hört er auf, denselben Fallsatz zu rufen, wird DIESE Datei rot — und nicht erst irgendwann
// jemandem auf.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DeduplizierenderKantenBestand } from "../../services/knowledge-object";
import { fuehreBestandsvertrag } from "./bestandsvertrag";

describe("JOB 4151 · Bestandsvertrag · Fassung 1 (Speicher)", () => {
  fuehreBestandsvertrag("InMemory", async () => new DeduplizierenderKantenBestand());
});

describe("JOB 4151 · V7 — die zweite Fassung existiert und fährt DENSELBEN Fallsatz", () => {
  const POSTGRES_DATEI = "tests/wissensgraph-integration/bestand-postgres.integration.test.ts";

  it("die Postgres-Fassung ruft `fuehreBestandsvertrag` mit `PgKantenRepo`", () => {
    const quelle = readFileSync(POSTGRES_DATEI, "utf8");
    expect(quelle, `${POSTGRES_DATEI} ruft den gemeinsamen Fallsatz nicht`).toContain(
      "fuehreBestandsvertrag(",
    );
    expect(quelle).toContain("new PgKantenRepo(");
    // Und sie bezieht ihn aus DIESER Datei — nicht aus einer abgeschriebenen zweiten Fassung.
    expect(quelle).toContain('from "./bestandsvertrag"');
  });
});
