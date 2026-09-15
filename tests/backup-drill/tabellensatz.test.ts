// ==================================================================================================
// JOB 4097 · LIEFERUNG 1 — DIE LÜCKE DIESES AUFTRAGS KANN KEIN ZWEITES MAL ENTSTEHEN.
// ==================================================================================================
//
// DER BEFUND, an dem dieser Wächter hängt: Seit JOB 517 stand im Restore-Drill
// `KERNTABELLEN=(kos users audit objects)`. Das Produkt migriert inzwischen 37 DDL-Stufen mit
// 39 Tabellen (`services/app/src/db.ts`, `schemas`). Ein Restore, der die Entwürfe (`drafts`), die
// Belege samt Anhangszuordnung (`ko_evidence`), die Validierungen (`ratings`, `assignments`), die
// Konfliktvermerke, die Import-Kandidaten oder die Lesevarianten verlor, kam mit **Exit 0** durch —
// der Betreiber las „Drill bestanden" und glaubte, sein Bestand sei zurück.
//
// DIE NAHELIEGENDE HALBHEIT WÄRE, die Liste im Skript von Hand um ein paar Namen zu verlängern. Das
// fällt beim nächsten neuen Schema wieder auseinander, und zwar SCHWEIGEND — genau so ist der
// heutige Zustand entstanden. Deshalb ist die Liste im Drill ab jetzt an die Migration GEBUNDEN:
// Kommt eine Migration dazu und `PFLICHTTABELLEN` wächst nicht mit, ist das Tor rot.
//
// WARUM DIE MIGRATIONSLISTE DAFÜR EXPORTIERT WIRD (`services/app/src/db.ts`): Die Alternative wäre,
// den Quelltext von `db.ts` hier zu zerlegen. Das wäre eine zweite Auslegung dessen, was wirklich
// ausgeführt wird — und die zweite ist die, die eines Tages auseinanderläuft. Der Export ist rein
// additiv: dieselben Konstanten, dieselbe Reihenfolge, dieselbe Ausführung.
import { describe, expect, it } from "vitest";
import { schemas } from "../../services/app/src/db";
import {
  nichtImDrill,
  nichtInDenSchemas,
  pflichttabellenAusDrill,
  tabellenAusSchemas,
} from "./pflichtsatz";

const tabellen = tabellenAusSchemas(schemas);
const pflicht = pflichttabellenAusDrill();

describe("JOB 4097 · der Pflichtsatz des Drills ist der Datenraum des Produkts", () => {
  it("die Erhebung trägt überhaupt etwas — sonst wäre jede Zusage darunter wertlos", () => {
    expect(schemas.length).toBeGreaterThanOrEqual(30);
    expect(tabellen.length).toBeGreaterThanOrEqual(30);
    // Die vier alten Kerntabellen sind Teil des Satzes, haben aber keinen Sonderrang mehr.
    for (const name of ["kos", "users", "audit", "objects"]) {
      expect(tabellen).toContain(name);
      expect(pflicht).toContain(name);
    }
    // Und das, was vorher fehlen durfte, ist jetzt drin.
    for (const name of ["ko_evidence", "drafts", "ratings", "import_candidates", "lesevarianten"]) {
      expect(pflicht).toContain(name);
    }
  });

  it("jede Tabelle, die migrate() anlegt, steht in PFLICHTTABELLEN", () => {
    const fehlend = nichtImDrill(tabellen, pflicht);
    expect(
      fehlend,
      `nicht im Drill geprüft: ${fehlend.join(", ")} — scripts/backup/restore-drill.sh, PFLICHTTABELLEN`,
    ).toEqual([]);
  });

  it("und PFLICHTTABELLEN führt keinen Namen, den keine Migration anlegt", () => {
    const ueberzaehlig = nichtInDenSchemas(tabellen, pflicht);
    expect(
      ueberzaehlig,
      `im Drill geprüft, aber von keiner Migration angelegt: ${ueberzaehlig.join(", ")}`,
    ).toEqual([]);
  });

  // ================================================================================================
  // RED-FIRST C — DER WÄCHTER WIRD AN EINER SIMULIERTEN MIGRATION GEMESSEN, NICHT AM PRODUKT.
  // ================================================================================================
  //
  // Ein Wächter, der nur „heute ist alles gleich" sagt, beweist nicht, dass er morgen anschlägt.
  // Hier wird deshalb die Lage von morgen hergestellt: eine ZUSÄTZLICHE Schema-Stufe, wie sie ein
  // neues Modul mitbrächte. Am Produkt ändert sich dabei nichts — `schemas` bleibt unberührt.
  it("C eine neue Migration ohne Eintrag im Drill wird erkannt (und mit Eintrag nicht mehr)", () => {
    const neueStufe = `
CREATE TABLE IF NOT EXISTS neue_stufe_4097 (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_neue_stufe_4097 ON neue_stufe_4097(id);
`;
    const morgen = tabellenAusSchemas([...schemas, neueStufe]);
    expect(morgen).toContain("neue_stufe_4097");

    // ROT: der Drill kennt sie nicht.
    expect(nichtImDrill(morgen, pflicht)).toEqual(["neue_stufe_4097"]);

    // GRÜN: mit dem Eintrag im Drill ist der Satz wieder vollständig.
    expect(nichtImDrill(morgen, [...pflicht, "neue_stufe_4097"])).toEqual([]);
  });

  it("die Namen werden aus den wirklich ausgeführten DDL-Zeichenketten gelesen, nicht geraten", () => {
    // Punktprobe an einer Stufe, deren Verlust der Auftrag beim Namen nennt: `ko_evidence` trägt
    // die Zuordnung Datei→Wissensobjekt (`data->>'objectId'`, repo-pg.ts:245-257).
    const evidence = schemas.find((ddl) => ddl.includes("CREATE TABLE IF NOT EXISTS ko_evidence"));
    expect(evidence, "KO_EVIDENCE_SCHEMA wird nicht migriert").toBeTruthy();
    expect(evidence).toContain("data->>'objectId'");
    expect(tabellenAusSchemas([evidence as string])).toEqual(["ko_evidence"]);
  });
});
