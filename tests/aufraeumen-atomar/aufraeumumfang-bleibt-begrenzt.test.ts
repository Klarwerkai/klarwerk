import { describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { AuditEntry, AuditRepo } from "../../services/audit";
import type { Conflict, ConflictRepo, OverlapEntry, OverlapRepo } from "../../services/conflicts";
import type { TxContext } from "../../services/db-tx";
import type { WithTx } from "../../services/knowledge-object";

// ================================================================================================
// JOB 3066 R2 · F4 — WIE VIEL ARBEIT DER TRANSAKTIONSKÖRPER HÄLT, UND WOVON SIE ABHÄNGT.
// ================================================================================================
//
// Der Vertrag von `PurgeTxCleanup` (services/knowledge-object/src/service.ts:248-255) schliesst im
// Transaktionskörper „Schleifen über Einzelobjekte" aus: der Körper hält eine Verbindung aus dem
// Pool, und n Einzelanweisungen halten die Sperre n-mal so lange. Runde 1 verstiess dagegen doppelt
// — sie las die GANZE Befundtabelle und schrieb je Treffer ein eigenes Update (bens
// Korrekturpflicht 3).
//
// Dieser Test misst die Form der Arbeit statt sie zu behaupten, und zwar an einer GROSSEN Menge:
// 200 offene Überschneidungen und 200 offene Konflikte an EINEM Beitrag.
//
//   SCHLIESSEN  — 1 MENGENBASIERTE Anweisung je Speicher (`closeOpenForKo`): kein `all()` (R1 zog
//                 den Gesamtbestand der Instanz durch die gehaltene Verbindung) und kein `update`
//                 je Treffer (R3 — n Anweisungen, n-mal die Sperre). Suchen und Schreiben liegen
//                 in EINEM Statement, das die geschlossenen Befunde zurückgibt. Diese Zahl wächst
//                 NICHT mit der Befundmenge: sie ist 1, ob ein Befund offen war oder 200.
//   BELEGE      — 1 je geschlossener Überschneidung, 2 je beendetem Konflikt. Das WÄCHST, und zwar
//                 erzwungen: die Audit-Ablage ist anhängend und führt je Ereignis eine Zeile
//                 (services/audit/src/repo-pg.ts); ein `appendMany` läge in `services/audit` (kein
//                 Zielpfad, §10 verbietet den Umbau der Audit-Kette), und ein Sammelbeleg wäre der
//                 Verlust der Rückverfolgbarkeit am einzelnen Befund.
//
// Die verbleibende Grenze wird hier benannt und festgenagelt, nicht überspielt (Lehre JOB 3039 R2).
// Die gemessene Obergrenze des ganzen Hakens lautet:
//   2 + 1 × (offene Überschneidungen dieses Beitrags) + 2 × (offene Konflikte dieses Beitrags),
// davon 2 Schreib-Anweisungen und der Rest Belege. Sie hängt an den Befunden GENAU DIESES
// Beitrags — nicht am Bestand der Instanz. Das ist der Unterschied, der im Transaktionskörper zählt.
describe("JOB 3066 R2 · F4: der Aufräumaufwand im Transaktionskörper ist gemessen und begrenzt", () => {
  const MENGE = 200;

  interface Zaehler {
    ueberschneidungen: Record<string, number>;
    konflikte: Record<string, number>;
    belege: number;
    belegeMitTx: number;
  }

  function zaehle(z: Record<string, number>, methode: string): void {
    z[methode] = (z[methode] ?? 0) + 1;
  }

  function aufbau() {
    const repos = inMemoryRepos();
    const zaehler: Zaehler = { ueberschneidungen: {}, konflikte: {}, belege: 0, belegeMitTx: 0 };
    const derKontext: TxContext = { brand: "TxContext" };
    let messen = false;

    const echteKonflikte = repos.conflictsRepo;
    const echteUeberschneidungen = repos.overlapRepo;
    const echterAudit = repos.auditRepo;

    const konflikte: ConflictRepo = {
      insert: (c) => echteKonflikte.insert(c),
      insertIfVersionsCurrent: (c, isCurrent) =>
        echteKonflikte.insertIfVersionsCurrent(c, isCurrent),
      supersedeIfOpen: (id, patch) => echteKonflikte.supersedeIfOpen(id, patch),
      findById: (id) => echteKonflikte.findById(id),
      update: (c: Conflict) => {
        if (messen) {
          zaehle(zaehler.konflikte, "update");
        }
        return echteKonflikte.update(c);
      },
      all: () => {
        if (messen) {
          zaehle(zaehler.konflikte, "all");
        }
        return echteKonflikte.all();
      },
      closeOpenForKo: (koId: string, patch: Partial<Conflict>, tx?: TxContext) => {
        if (messen) {
          zaehle(zaehler.konflikte, "closeOpenForKo");
        }
        return echteKonflikte.closeOpenForKo(koId, patch, tx);
      },
    };

    const ueberschneidungen: OverlapRepo = {
      insert: (e) => echteUeberschneidungen.insert(e),
      insertIfVersionsCurrent: (e, isCurrent) =>
        echteUeberschneidungen.insertIfVersionsCurrent(e, isCurrent),
      supersedeIfOpen: (id, patch) => echteUeberschneidungen.supersedeIfOpen(id, patch),
      findById: (id) => echteUeberschneidungen.findById(id),
      update: (e: OverlapEntry) => {
        if (messen) {
          zaehle(zaehler.ueberschneidungen, "update");
        }
        return echteUeberschneidungen.update(e);
      },
      all: () => {
        if (messen) {
          zaehle(zaehler.ueberschneidungen, "all");
        }
        return echteUeberschneidungen.all();
      },
      closeOpenForKo: (koId: string, patch: Partial<OverlapEntry>, tx?: TxContext) => {
        if (messen) {
          zaehle(zaehler.ueberschneidungen, "closeOpenForKo");
        }
        return echteUeberschneidungen.closeOpenForKo(koId, patch, tx);
      },
    };

    const audit: AuditRepo = {
      append: (entry: AuditEntry, tx?: TxContext) => {
        if (messen) {
          zaehler.belege += 1;
          if (tx === derKontext) {
            zaehler.belegeMitTx += 1;
          }
        }
        return echterAudit.append(entry, tx);
      },
      appendOnce: (entry, tx) => echterAudit.appendOnce(entry, tx),
      all: () => echterAudit.all(),
      last: (tx) => echterAudit.last(tx),
    };

    const withTx: WithTx = (fn) => fn(derKontext);
    const services = assembleServices(
      {
        ...repos,
        auditRepo: audit,
        conflictsRepo: konflikte,
        overlapRepo: ueberschneidungen,
      },
      { withTx },
    );
    buildApp(services); // die Aufräum-Haken leben in der Kompositionswurzel
    const ab = (): void => {
      messen = true;
    };
    return { services, zaehler, ab };
  }

  it(`${MENGE} Überschneidungen und ${MENGE} Konflikte: GENAU 1 Schliess-Anweisung je Speicher, Belege je Befund`, async () => {
    const { services, zaehler, ab } = aufbau();
    const a = await services.ko.create({
      title: "KO A",
      statement: "Pumpe entlüften alle 200h.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    for (let i = 0; i < MENGE; i += 1) {
      const partner = await services.ko.create({
        title: `KO ${i}`,
        statement: `Pumpe alle 200 Stunden entlüften (${i}).`,
        type: "best_practice",
        category: "Wartung",
        author: "bob",
      });
      await services.overlaps.createAuto(
        {
          koA: a.id,
          koB: partner.id,
          relation: "identisch",
          aspects: [
            { beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" },
          ],
          eigenanteilA: "",
          eigenanteilB: "",
          recommendation: "zusammenfuehren",
        },
        { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
        "system",
      );
      await services.conflicts.create(
        { koA: a.id, koB: partner.id, type: "truth", description: `Widerspruch ${i}` },
        "anna",
      );
    }
    expect(await services.overlaps.unresolved()).toHaveLength(MENGE);
    expect(await services.conflicts.unresolved()).toHaveLength(MENGE);

    ab(); // ab hier zählt nur noch das Fenster der Endlöschung
    await services.ko.delete(a.id, "admin", { hard: true });

    // DAS SCHLIESSEN: genau EINE Anweisung je Speicher, bei 200 Befunden wie bei einem. Stünde
    // hier ein `all: 1`, zöge der Transaktionskörper wieder den Gesamtbestand der Instanz durch
    // die gehaltene Verbindung; stünde hier `update: MENGE`, hielte er die Sperre MENGE-mal.
    expect(zaehler.ueberschneidungen).toEqual({ closeOpenForKo: 1 });
    expect(zaehler.konflikte).toEqual({ closeOpenForKo: 1 });

    // Die BELEGE: die benannte, von der Audit-Kette erzwungene Linearität — plus der eine
    // ko.purged-Beleg.
    expect(zaehler.belege).toBe(MENGE + 2 * MENGE + 1);
    // Und JEDER von ihnen fährt auf dem Kontext derselben Transaktion mit.
    expect(zaehler.belegeMitTx).toBe(zaehler.belege);

    // Die Wirkung stimmt: alles zu, und der Beleg nennt seinen Umfang.
    expect(await services.overlaps.unresolved()).toHaveLength(0);
    expect(await services.conflicts.unresolved()).toHaveLength(0);
    const beleg = (await services.audit.list({ action: "ko.purged" })).find(
      (e) => e.target === a.id,
    );
    expect(beleg?.payload).toMatchObject({
      ueberschneidungenGeschlossen: MENGE,
      konflikteGeschlossen: MENGE,
    });
  });
});
