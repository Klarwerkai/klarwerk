// ================================================================================================
// JOB 3583 · DER MASSSTAB, GEMESSEN — DIE RANGFOLGE DES SPEICHERBESTANDS AM SELBEN BESTAND.
// ================================================================================================
//
// WOZU DIESE DATEI NEBEN V1. Der Auftrag misst die Gleichheit ZWEIER Adapter an einem Bestand. Die
// Postgres-Hälfte braucht eine echte Datenbank und läuft nur unter `test:integration`; die
// MASSSTAB-Hälfte braucht keine und gehört deshalb in den regulären Lauf. Hier steht also schwarz
// auf weiss, WELCHE Reihenfolge `InMemoryKoRepo` an genau diesem Bestand liefert — die Zahlenfolge,
// gegen die V1 die Datenbank hält. Ohne sie stünde in der Rückgabe eine Erwartung, die niemand
// gemessen hat.
//
// Gemessen wird die Methode selbst — `InMemoryKoRepo.findCandidates` (repo.ts:615-633) —, nicht die
// Regel nachgebaut. Ein PRODUKTPFAD ist sie nicht: sie hat im Produkt keinen Aufrufer (JOB 3607,
// `toter-kandidatenweg.test.ts`); gemessen wird der Massstab für V1, nicht das Verhalten von Klara.
// Die Reihenfolge wird zusätzlich ausgegeben, damit sie in der Rückgabe wörtlich aus einem Lauf
// zitiert werden kann.
import { describe, expect, it } from "vitest";
import { InMemoryKoRepo } from "../../services/knowledge-object/src/repo";
import { BESTAND, ERWARTETE_REIHENFOLGE, TERME } from "./bestand";

async function speicher(): Promise<InMemoryKoRepo> {
  const repo = new InMemoryKoRepo();
  for (const eintrag of BESTAND) {
    await repo.insert(eintrag);
  }
  return repo;
}

async function kennungen(terms: readonly string[], limit: number): Promise<string[]> {
  const repo = await speicher();
  return (await repo.findCandidates({ terms: [...terms], limit })).map((k) => k.id);
}

describe("JOB 3583 · Massstab: die Rangfolge des Speicherbestands am Auftragsbestand", () => {
  it("MESSUNG · zwölf Wörter, sechs Objekte: Trefferzahl ↓, dann validiert, dann Trust ↓", async () => {
    const ganz = await kennungen(TERME, 10);
    const gedeckelt = await kennungen(TERME, 3);
    process.stdout.write(
      [
        "",
        "JOB 3583 — MASSSTAB (InMemoryKoRepo.findCandidates am Auftragsbestand):",
        `  terme(${TERME.length}) = ${JSON.stringify(TERME)}`,
        `  limit 10 → ${JSON.stringify(ganz)}`,
        `  limit  3 → ${JSON.stringify(gedeckelt)}`,
        "",
      ].join("\n"),
    );
    expect(ganz).toEqual(ERWARTETE_REIHENFOLGE);
    expect(gedeckelt).toEqual(ERWARTETE_REIHENFOLGE.slice(0, 3));
    // Der Kern: das score-starke, NICHT validierte Objekt überlebt den Deckel.
    expect(gedeckelt).toContain("stark-offen");
  });

  it("bei GLEICHER Trefferzahl bleibt validiert vor offen", async () => {
    expect(await kennungen(["pumpe"], 5)).toEqual(["validiert-zwei", "stark-offen"]);
    expect(await kennungen(["pumpe"], 1)).toEqual(["validiert-zwei"]);
  });

  it("ein Term in mehreren Feldern DESSELBEN Objekts zählt EINMAL", async () => {
    // `offen-klein` trägt `leitung` im Titel UND in der Aussage; alle drei Treffer haben deshalb
    // die Trefferzahl 1, und es entscheiden validiert und Trust. Zählte je FELD, stünde
    // `offen-klein` mit 2 vorn — das ist die Verstellung der Gegenprobe A8.
    expect(await kennungen(["leitung", "wartung"], 5)).toEqual([
      "validiert-hoch",
      "offen-klein",
      "stark-offen",
    ]);
  });

  it("Zustandsmodell: leere Terme, kein Treffer und limit 0 → leere Liste, kein All-Pool", async () => {
    expect(await kennungen([], 10)).toEqual([]);
    expect(await kennungen(["aktienkurs"], 10)).toEqual([]);
    expect(await kennungen(TERME, 0)).toEqual([]);
  });
});
