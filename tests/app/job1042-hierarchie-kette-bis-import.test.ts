// ================================================================================================
// JOB 1042 · D3 — DER BEFUND MUSS DORT ANKOMMEN, WO JEMAND IHN SIEHT
// ================================================================================================
//
// Das Vollurteil beschreibt die gewünschte Kette (Nutzenkette, Z. 159-160):
//   `reale Page-ID + stabile Parent-ID + entschiedene Reihenfolge/Tiefe → VALIDIERTER BAUMLESER →
//    persistiertes Zielmodell → UI/Abnahme`
//
// Diese Datei baut das Stück, das INNERHALB der Lease liegt:
//   `mapper (Baumleser) → adapter.collectAll() → runConfluenceImport() → ImportRunSummary`
//
// Alle drei Stationen sind geleast (`adapter.ts`, `confluence-import.ts`, `mapper.ts`). Das
// PERSISTIERTE Zielmodell ist es NICHT — `ImportItem` liegt in `services/library-analytics/src/
// types.ts`, ausserhalb der Lease. Deshalb reist der Befund hier als DIAGNOSE bis in die
// Laufzusammenfassung und nicht als Feld am Item; die Scopegrenze ist in der Rückgabe benannt.
//
// WARUM ÜBERHAUPT BIS IN DIE ZUSAMMENFASSUNG: Ein Baumleser, den niemand aufruft, ist kein
// Produktfortschritt. Der Urteilspunkt „SERVERINTERN, Verluststelle gefunden, Zielwirkung offen"
// (Z. 150) schliesst sich erst, wenn das Ergebnis eine Station erreicht, die ein Mensch liest.
//
// UND WAS ER NICHT TUT: Er ändert das Import-Ergebnis nicht. Die fail-closed Regel ist Ownerfrage
// (Korrekturpflicht 1); bis sie entschieden ist, wird gezählt und gemeldet, nicht abgebrochen.
// `Z3` pinnt genau das.
import { describe, expect, it } from "vitest";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
import { adapterFromConfig } from "../../services/confluence/src/adapter";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";

function fetchReturning(pages: ConfluencePage[]): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ results: pages }),
    }) as unknown as Response) as unknown as typeof fetch;
}

const config = (fetchFn: typeof fetch) => ({
  baseUrl: "https://acme.atlassian.net/wiki",
  email: "svc@acme.example",
  apiToken: "read-only-tok",
  spaceKey: "K",
  fetchFn,
});

function seite(
  id: string,
  title: string,
  ancestors?: { id?: string; title?: string }[],
): ConfluencePage {
  return {
    id,
    title,
    ...(ancestors ? { ancestors } : {}),
    body: { storage: { value: `<p>${title}</p>` } },
    version: { number: 1 },
  };
}

const WURZEL = { id: "1", title: "Raum" };

describe("JOB1042 D3 · Z — der Hierarchie-Befund reist bis in die Sammel-Zusammenfassung", () => {
  it("Z1: ein sauberer Baum meldet vollständige Ketten und keinen einzigen Mangel", async () => {
    const adapter = adapterFromConfig(
      config(
        fetchReturning([
          seite("1", "Raum"),
          seite("2", "Kind A", [WURZEL]),
          seite("3", "Enkel", [WURZEL, { id: "2", title: "Kind A" }]),
        ]),
      ),
    );
    const ergebnis = await adapter.collectAll();

    expect(ergebnis.items).toHaveLength(3);
    // Der Befund existiert und ist vollständig — nicht „irgendwie ok".
    expect(ergebnis.hierarchie).toEqual({
      seiten: 3,
      mitKette: 2, // die Wurzelseite hat keine Kette und ist deshalb KEIN Mangel
      wurzeln: 1,
      maximaleTiefe: 2,
      fehlendeId: [],
      zyklus: [],
      doppelteId: [],
      verwaisterElternteil: [],
    });
  });

  it("Z2: jeder Mangel wird EINZELN und mit Seitenbezug gemeldet", async () => {
    const adapter = adapterFromConfig(
      config(
        fetchReturning([
          seite("1", "Raum"),
          // fehlende ID in der Kette
          seite("2", "Lücke", [{ title: "Namenloser Ordner" }]),
          // Zyklus: die Seite ist ihr eigener Vorfahr
          seite("3", "Kreis", [WURZEL, { id: "3", title: "Kreis" }]),
          // verwaister Elternteil: 99 ist in dieser Sammlung nicht enthalten
          seite("4", "Waise", [{ id: "99", title: "Fremd" }]),
          // doppelte ID: dieselbe Seiten-ID zweimal in der Sammlung
          seite("5", "Doppelt A", [WURZEL]),
          seite("5", "Doppelt B", [WURZEL]),
        ]),
      ),
    );
    const { hierarchie } = await adapter.collectAll();

    expect(hierarchie?.fehlendeId).toEqual(["2"]);
    expect(hierarchie?.zyklus).toEqual(["3"]);
    expect(hierarchie?.verwaisterElternteil).toEqual(["4"]);
    expect(hierarchie?.doppelteId).toEqual(["5"]);
    // Die Zählung bleibt ehrlich: sechs gelieferte Seiten, auch wenn zwei dieselbe ID tragen.
    expect(hierarchie?.seiten).toBe(6);
  });

  it("Z3 · DIE OWNERFRAGE BLEIBT OFFEN: kein Mangel verhindert das Einsammeln", async () => {
    // Korrekturpflicht 1 ist ungelöst. Bis Pedi entschieden hat, ist der Befund eine AUSKUNFT und
    // keine Sperre — sonst hätte dieser Durchgang die Entscheidung getroffen. Wird der Import
    // eines Tages fail-closed, wird dieser Fall rot; genau dann ist es eine Entscheidung.
    const adapter = adapterFromConfig(
      config(
        fetchReturning([
          seite("1", "Raum"),
          seite("2", "Lücke", [{ title: "Namenloser Ordner" }]),
          seite("3", "Kreis", [WURZEL, { id: "3", title: "Kreis" }]),
        ]),
      ),
    );
    const ergebnis = await adapter.collectAll();

    // ALLE drei Seiten sind gemappt, keine ist ausgefallen, nichts ist abgeschnitten.
    expect(ergebnis.items).toHaveLength(3);
    expect(ergebnis.failed).toEqual([]);
    expect(ergebnis.truncated).toBe(false);
    // Und der Titelweg der mangelhaften Seite ist unverändert vollständig.
    expect(ergebnis.items[1]?.sourcePath).toEqual(["Namenloser Ordner"]);
  });

  it("Z4 · ANTI-VAKUUM: derselbe Aufrufweg trennt sauber von mangelhaft", async () => {
    // Ohne dieses Paar wäre Z1 auch dann grün, wenn der Leser gar nichts prüft und immer leere
    // Listen liefert. Beide Läufe gehen durch DIESELBE Stelle und müssen sich unterscheiden.
    const sauber = await adapterFromConfig(
      config(fetchReturning([seite("1", "Raum"), seite("2", "Kind", [WURZEL])])),
    ).collectAll();
    const kaputt = await adapterFromConfig(
      config(fetchReturning([seite("1", "Raum"), seite("2", "Kind", [{ title: "ohne id" }])])),
    ).collectAll();

    expect(sauber.hierarchie?.fehlendeId).toEqual([]);
    expect(kaputt.hierarchie?.fehlendeId).toEqual(["2"]);
    expect(sauber.hierarchie?.mitKette).toBe(1);
    expect(kaputt.hierarchie?.mitKette).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
describe("JOB1042 D3 · S — der Befund erreicht die Station, die ein Mensch liest", () => {
  async function lauf(pages: ConfluencePage[], dryRun = true) {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    return runConfluenceImport({
      adapter: adapterFromConfig(config(fetchReturning(pages))),
      library: new LibraryService({ koService }),
      koService,
      dryRun,
      actor: "job1042@test",
    });
  }

  it("S1: die Laufzusammenfassung trägt den Hierarchie-Befund unverändert", async () => {
    const summary = await lauf([
      seite("1", "Raum"),
      seite("2", "Kind", [WURZEL]),
      seite("3", "Lücke", [{ title: "ohne id" }]),
    ]);
    expect(summary.hierarchie).toEqual({
      seiten: 3,
      mitKette: 1,
      wurzeln: 1,
      maximaleTiefe: 1,
      fehlendeId: ["3"],
      zyklus: [],
      doppelteId: [],
      verwaisterElternteil: [],
    });
  });

  it("S2 · DIE ZAHLEN DES LAUFS BLEIBEN UNBERÜHRT — der Befund ist Auskunft, keine Sperre", async () => {
    // Dieselbe Zusicherung wie Z3, aber eine Ebene höher und an den Zählern, die ein Mensch liest.
    // Drei Seiten, davon eine mangelhaft: es werden trotzdem DREI eingereiht, keine fällt aus.
    const summary = await lauf([
      seite("1", "Raum"),
      seite("2", "Kind", [WURZEL]),
      seite("3", "Lücke", [{ title: "ohne id" }]),
    ]);
    expect(summary.found).toBe(3);
    expect(summary.imported).toBe(3);
    expect(summary.skipped).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.perPage.every((p) => p.status === "imported")).toBe(true);
    // Der Mangel steht daneben, nicht davor.
    expect(summary.hierarchie?.fehlendeId).toEqual(["3"]);
  });

  it("S3 · ANTI-VAKUUM: ein Lauf ohne jeden Mangel meldet leere Listen, nicht ein fehlendes Feld", async () => {
    // Ohne diesen Fall wäre S1 auch dann grün, wenn das Feld nur bei Mängeln gesetzt würde — dann
    // wäre „kein Feld" von „geprüft und sauber" nicht unterscheidbar, und genau diese Verwechslung
    // ist die stille Null, die das Produkt an anderer Stelle schon einmal gekostet hat.
    const summary = await lauf([seite("1", "Raum"), seite("2", "Kind", [WURZEL])]);
    expect(summary.hierarchie).toBeDefined();
    expect(summary.hierarchie?.fehlendeId).toEqual([]);
    expect(summary.hierarchie?.zyklus).toEqual([]);
    expect(summary.hierarchie?.doppelteId).toEqual([]);
    expect(summary.hierarchie?.verwaisterElternteil).toEqual([]);
    expect(summary.hierarchie?.mitKette).toBe(1);
  });
});
