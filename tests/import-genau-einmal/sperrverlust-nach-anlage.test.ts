// ================================================================================================
// LAUF gesamt-import-adoption:2, NACHARBEIT NACH RUNDE 3 — BENS BEFUNDE B4 UND B5.
// ================================================================================================
//
// B4  Die Frage `sperreGilt` VOR `create` schützte den späteren Insert nicht. Ben hat A nach
//     bestandener Frage unmittelbar vor dem Insert angehalten, die Sperrsitzung verlieren lassen,
//     B anlegen lassen — danach legte A ebenfalls an: zwei Kennungen, beide Annahmen „angenommen".
//     Seitdem fragt `acceptToKo` NACH dem Insert noch einmal; hält die Sperre nicht mehr, entscheidet
//     ein zweiter Durchgang, ob das eigene Objekt bleibt oder als zweite Kennung entfernt wird.
// B5  Die Recovery einer Neuanlage behielt einen Einreihungsbefund `wiederverwendet` mit der
//     Kennung eines inzwischen endgültig gelöschten Trägers.
//
// Die Sperr-Fälle übernehmen Bens Gegenprobe (`ben-r3-sperrverlust-insert.test.ts`): modelliert
// ist NUR der Advisory-Lock-Transport und seine Freigabe beim Sitzungsverlust; `PgCandidateRepo`,
// `LibraryService`, `KoService` und die echten InMemory-Inserts sind Produktcode. Keine Datenbank,
// kein Socket. Die Wirkung gegen echtes Postgres prüft `annahme-sperre-pg.integration.test.ts`, S7.
import { Client, type Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import type { ImportCandidate as WebImportCandidate } from "../../apps/web/src/api/types";
import { candidateFindings } from "../../apps/web/src/lib/extConcept";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type CandidateRepo,
  type ClaimResolution,
  type DublettenPruefung,
  InMemoryCandidateRepo,
  LibraryService,
  PgCandidateRepo,
  REVIEW_CLAIM_LEASE_MS,
} from "../../services/library-analytics";

const NIE_AEHNLICH: DublettenPruefung = () => ({ dublette: false });

/** Bens Sperrtransport: ein Halter, eine Warteschlange, Freigabe bei COMMIT/ROLLBACK/Abbruch. */
function sperrtransport() {
  let halter: string | null = null;
  const wartende: Array<{ name: string; dran: () => void }> = [];
  const freigeben = (name: string) => {
    if (halter !== name) {
      return;
    }
    const naechster = wartende.shift();
    halter = naechster?.name ?? null;
    naechster?.dran();
  };
  const pool = (name: string) => {
    const client = new Client();
    let kaputt = false;
    const fehler = Object.assign(new Error("Sperrsitzung verloren"), { code: "ECONNRESET" });
    client.query = (async (sql: string) => {
      if (kaputt) {
        throw fehler;
      }
      if (sql.startsWith("SELECT pg_advisory_xact_lock")) {
        if (halter === null) {
          halter = name;
        } else {
          await new Promise<void>((r) => wartende.push({ name, dran: r }));
        }
      }
      if (sql === "COMMIT" || sql === "ROLLBACK") {
        freigeben(name);
      }
      return { rows: [], rowCount: 0 };
    }) as unknown as typeof client.query;
    Object.assign(client, { release: () => freigeben(name) });
    return {
      pool: { connect: async () => client } as unknown as Pool,
      abbrechen: () => {
        kaputt = true;
        freigeben(name);
        (client as unknown as { _handleErrorEvent(e: Error): void })._handleErrorEvent(fehler);
      },
    };
  };
  return { pool, wartende: () => wartende.length };
}

/** Lässt den ERSTEN echten Insert der Ablage anhalten, bis `fortsetzen()` gerufen wird. */
function verzoegerteAblage() {
  let betreten: () => void = () => undefined;
  let fortsetzen: () => void = () => undefined;
  const bereit = new Promise<void>((r) => {
    betreten = r;
  });
  const tor = new Promise<void>((r) => {
    fortsetzen = r;
  });
  class Ablage extends InMemoryKoRepo {
    erster = true;
    override async insert(input: Parameters<InMemoryKoRepo["insert"]>[0]): Promise<void> {
      if (this.erster) {
        this.erster = false;
        betreten();
        await tor;
      }
      return super.insert(input);
    }
  }
  return { repo: new Ablage(), bereit, fortsetzen: () => fortsetzen() };
}

async function aufbau(anker: boolean) {
  const transport = sperrtransport();
  const aPool = transport.pool("A");
  const bPool = transport.pool("B");
  const gemeinsam = new InMemoryCandidateRepo();
  // Gemeinsamer Kandidatenbestand, die Sperre aber je Instanz über den Pg-Adapter.
  const mitSperre = (pg: PgCandidateRepo): CandidateRepo => {
    return new Proxy(gemeinsam, {
      get(ziel, name) {
        if (name === "annahmeSperre") {
          return pg.annahmeSperre.bind(pg);
        }
        const wert = Reflect.get(ziel, name);
        return typeof wert === "function" ? wert.bind(ziel) : wert;
      },
    });
  };
  const ablage = verzoegerteAblage();
  const ko = new KoService({ repo: ablage.repo });
  await ko.activateSearchProjectionV2();
  const aDienst = new LibraryService({
    koService: ko,
    candidates: mitSperre(new PgCandidateRepo(aPool.pool)),
    externalUpsert: anker,
  });
  const bDienst = new LibraryService({
    koService: ko,
    candidates: mitSperre(new PgCandidateRepo(bPool.pool)),
    externalUpsert: anker,
  });
  const item = {
    title: "Filterwechsel",
    statement: "Die Filterkerze beim Oelwechsel tauschen",
    type: "best_practice" as const,
    category: "Wartung",
    confidentiality: "intern" as const,
    ...(anker ? { provider: "wiki", externalId: "quelle-42" } : {}),
  };
  return { transport, aPool, ko, ablage, aDienst, bDienst, item, gemeinsam };
}

describe("B4 · Sperrverlust nach der letzten Prüfung, vor dem echten Insert", () => {
  for (const anker of [false, true]) {
    const weg = anker ? "Herkunftsanker" : "Textweg";

    it(`${weg} (Bens Gegenprobe): B legt in der Lücke an, A setzt fort → genau EINE Kennung, A nennt Bs Objekt`, async () => {
      const { transport, aPool, ko, ablage, aDienst, bDienst, item } = await aufbau(anker);
      const [a] = await aDienst.createImportCandidates(
        [{ ...item, sourceVersion: 1 }],
        "imp",
        NIE_AEHNLICH,
      );
      const [b] = await bDienst.createImportCandidates(
        [{ ...item, sourceVersion: 2 }],
        "imp",
        NIE_AEHNLICH,
      );
      const aLauf = aDienst.reviewImportCandidate(
        a!.id,
        "accept",
        "rev-a",
        undefined,
        NIE_AEHNLICH,
      );
      await ablage.bereit;
      const bLauf = bDienst.reviewImportCandidate(
        b!.id,
        "accept",
        "rev-b",
        undefined,
        NIE_AEHNLICH,
      );
      await vi.waitFor(() => expect(transport.wartende()).toBe(1));
      expect(await ko.list(), "Vor dem Sitzungsverlust wartet B tatsächlich.").toHaveLength(0);
      aPool.abbrechen();
      const rb = await bLauf;
      expect(await ko.list()).toHaveLength(1);
      ablage.fortsetzen();
      const ra = await aLauf;

      const kos = await ko.list();
      expect(kos, "Der fortgesetzte Lauf A hinterlässt keine zweite Kennung.").toHaveLength(1);
      expect(kos[0]?.id).toBe(rb.koId);
      expect(kos[0]?.importCandidateId).toBe(b!.id);
      expect(ra.status).toBe("angenommen");
      if (anker) {
        expect(ra.koId).toBe(rb.koId);
        expect(ra.dublettenbefund).toEqual({
          ergebnis: "wiederverwendet",
          treffer: { art: "wissensobjekt", koId: rb.koId },
        });
      } else {
        expect(ra.koId).toBeNull();
        expect(ra.dublettenbefund).toEqual({
          ergebnis: "identisch",
          treffer: { art: "wissensobjekt", koId: rb.koId },
        });
      }
      expect(await ko.findByImportCandidateId(a!.id), "As Objekt ist entfernt.").toBeUndefined();
    });

    it(`${weg}: Sperrverlust nach dem Insert, KEIN Mitbewerber → As Objekt bleibt, Erstanlage-Befund`, async () => {
      const { aPool, ko, ablage, aDienst, item } = await aufbau(anker);
      const [a] = await aDienst.createImportCandidates(
        [{ ...item, sourceVersion: 1 }],
        "imp",
        NIE_AEHNLICH,
      );
      const aLauf = aDienst.reviewImportCandidate(
        a!.id,
        "accept",
        "rev-a",
        undefined,
        NIE_AEHNLICH,
      );
      await ablage.bereit;
      aPool.abbrechen();
      ablage.fortsetzen();
      const ra = await aLauf;
      const kos = await ko.list();
      expect(kos).toHaveLength(1);
      expect(ra.status).toBe("angenommen");
      expect(ra.koId).toBe(kos[0]?.id);
      expect(ra.dublettenbefund).toEqual({ ergebnis: anker ? "nicht_gestellt" : "keine" });
      expect(candidateFindings(ra as unknown as WebImportCandidate).acceptedKo).toBe(true);
    });
  }
});

describe("B5 · die Recovery einer Neuanlage nennt keine gelöschte Kennung", () => {
  class AbschlussFaelltAus extends InMemoryCandidateRepo {
    rest = 0;
    override resolveClaim(id: string, opId: string, next: ClaimResolution) {
      if (this.rest > 0 && next.status === "angenommen" && next.koId) {
        this.rest -= 1;
        return Promise.reject(new Error("Statuswrite faellt aus"));
      }
      return super.resolveClaim(id, opId, next);
    }
  }

  it("Bens Gegenprobe: eingereiht `wiederverwendet`, Träger endgültig gelöscht, Neuanlage, beide Abschlusswrites fallen aus → Recovery: `nicht_gestellt`, „KO erzeugt“", async () => {
    const candidates = new AbschlussFaelltAus();
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    await ko.activateSearchProjectionV2();
    let now = Date.parse("2026-10-01T08:00:00Z");
    const library = new LibraryService({
      koService: ko,
      candidates,
      externalUpsert: true,
      now: () => now,
    });
    const item = {
      title: "Filter wechseln",
      statement: "Die Filterkerze erneuern",
      type: "best_practice" as const,
      category: "Wartung",
      confidentiality: "intern" as const,
      provider: "wiki",
      externalId: "filter-42",
      sourceVersion: 1,
    };
    const [a] = await library.createImportCandidates([item], "imp");
    const ra = await library.reviewImportCandidate(a!.id, "accept", "rev");
    const [b] = await library.createImportCandidates([{ ...item, sourceVersion: 2 }], "imp");
    expect(b!.dublettenbefund).toEqual({
      ergebnis: "wiederverwendet",
      treffer: { art: "wissensobjekt", koId: ra.koId },
    });
    await ko.delete(ra.koId as string, "rev", { hard: true });
    expect(await ko.list()).toHaveLength(0);
    candidates.rest = 2;
    await expect(library.reviewImportCandidate(b!.id, "accept", "rev")).rejects.toThrow(
      "Statuswrite",
    );
    expect(candidates.rest).toBe(0);
    const [neu] = await ko.list();
    expect(neu?.id).not.toBe(ra.koId);
    expect(neu?.importCandidateId).toBe(b!.id);

    now += REVIEW_CLAIM_LEASE_MS + 1;
    expect(await library.recoverStaleReviewClaims()).toEqual({ completed: 1, released: 0 });
    const gespeichert = await candidates.findById(b!.id);
    expect(gespeichert?.koId).toBe(neu?.id);
    expect(gespeichert?.dublettenbefund).toEqual({ ergebnis: "nicht_gestellt" });
    expect(gespeichert?.duplicate).toBe(false);
    const f = candidateFindings(gespeichert as unknown as WebImportCandidate);
    expect(f.wiederverwendet).toBeNull();
    expect(f.acceptedKo).toBe(true);
  });
});
