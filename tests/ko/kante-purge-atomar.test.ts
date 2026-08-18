// ================================================================================================
// JOB 1104 · D1 (Scheibe S0-TX) — DER TRANSAKTIONSGEBUNDENE AUFRAEUM-HAKEN UND SEINE ROLLBACKKLAMMER.
// ================================================================================================
//
// WORUM ES GEHT, UND WARUM ES EINE EIGENE SCHEIBE IST. JOB 1045 D3 hatte die Aufraeumarbeit der
// Endloeschung in den VORGESCHALTETEN `onPurge`-Cleanup gelegt und das „atomar" genannt. BEN3 hat
// das widerlegt, und D4 §2.2 hat die Konsequenz gezogen — woertlich:
//
//   „Gelingt das Cleanup, aber der DANACH folgende Delete+Audit-Block scheitert, bleibt ein
//    unveraendertes, weiterhin existierendes KO mit bereits geschlossenen Folgeartefakten zurueck."
//
// Fuer Konflikte und Ueberschneidungen traegt dieses Argument: sie sind idempotent, ein
// Wiederholungslauf heilt sie. Fuer einen NICHT idempotenten Folgeartefakt-Schreiber traegt es
// nicht — was er entfernt hat, stellt kein erneuter Purge wieder her. Das ist kein
// Selbstheilungs-, sondern ein Datenverlustfenster.
//
// DIESE DATEI BEWEIST DIE INFRASTRUKTUR, NICHT IHREN ERSTEN NUTZER. Der Schreiber unten ist ein
// GEPUFFERTES TESTDOUBLE auf demselben `TxContext` — genau das verlangt D4 §5 fuer diese Scheibe:
// „Sie baut die Schnittstelle, in die die Kantenloeschung spaeter eintritt, und beweist sie mit
// einem tx-gebundenen Schreiber." Ein Kantenaggregat entsteht hier ausdruecklich NICHT.
//
// A1 IST DIE KALIBRIERUNG UND NICHT VERHANDELBAR: ohne einen gruenen Erfolgsfall im selben Lauf
// waere „nichts geloescht" in A2-A4 von einem nie verdrahteten Haken nicht zu unterscheiden.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AuditRepo } from "../../services/audit/src/repo";
import { InMemoryAuditRepo } from "../../services/audit/src/repo";
import { AuditService } from "../../services/audit/src/service";
import type { TxContext } from "../../services/db-tx";
import { InMemoryKoRepo, type KoRepo } from "../../services/knowledge-object/src/repo";
import {
  KoService,
  type PurgeTxCleanup,
  type WithTx,
} from "../../services/knowledge-object/src/service";

type TxOp = () => void;

function failOnce(): { arm: () => void; consume: () => boolean } {
  let armed = false;
  return {
    arm: () => {
      armed = true;
    },
    consume: () => {
      if (!armed) {
        return false;
      }
      armed = false;
      return true;
    },
  };
}

/**
 * Der gepufferte Testschreiber — das Gegenstueck zu einem echten `KantenRepo`.
 *
 * Er verhaelt sich wie ein transaktionsfaehiger Schreiber: die WIRKUNG (`entfernt`) tritt erst
 * ein, wenn die Klammer committet; die ZAHL steht sofort, weil sie in den `ko.purged`-Payload
 * wandern muss (D4 §2.2 — sonst muesste der Aufrufer ein zweites Mal zaehlen, und das waere eine
 * zusaetzliche Leseoperation innerhalb der Sperre).
 */
function testschreiber(stage: (tx: TxContext | undefined, op: TxOp) => void) {
  const bestand = new Map<string, number>();
  const fehler = failOnce();
  let aufrufe = 0;
  return {
    bestand,
    fehler,
    aufrufe: () => aufrufe,
    /** Legt `anzahl` Folgeartefakte fuer `koId` an. */
    fuelle: (koId: string, anzahl: number) => bestand.set(koId, anzahl),
    hook: ((koId, _actor, tx) => {
      aufrufe += 1;
      if (fehler.consume()) {
        return Promise.reject(new Error("aufraeumen kaputt"));
      }
      const anzahl = bestand.get(koId) ?? 0;
      stage(tx, () => {
        bestand.delete(koId);
      });
      return Promise.resolve({ folgeartefakteGeloescht: anzahl });
    }) satisfies PurgeTxCleanup,
  };
}

function harness() {
  const koInner = new InMemoryKoRepo();
  const auditInner = new InMemoryAuditRepo();
  const staging = new WeakMap<TxContext, TxOp[]>();
  const deleteFehler = failOnce();
  const auditFehler = failOnce();

  function stage(tx: TxContext | undefined, op: TxOp): void {
    const ops = tx && staging.get(tx);
    if (ops) {
      ops.push(op);
    } else {
      op();
    }
  }

  const koRepo = new Proxy(koInner, {
    get(ziel, name, empfaenger) {
      if (name === "delete") {
        return (id: string, tx?: TxContext) => {
          if (deleteFehler.consume()) {
            return Promise.reject(new Error("delete kaputt"));
          }
          stage(tx, () => {
            void ziel.delete(id);
          });
          return Promise.resolve();
        };
      }
      return Reflect.get(ziel, name, empfaenger);
    },
  }) as unknown as KoRepo;

  const auditRepo: AuditRepo = {
    append: (entry, tx) => {
      if (auditFehler.consume()) {
        return Promise.reject(new Error("audit kaputt"));
      }
      stage(tx, () => {
        void auditInner.append(entry);
      });
      return Promise.resolve();
    },
    all: () => auditInner.all(),
    last: (tx) => auditInner.last(tx),
    appendOnce: (entry) => auditInner.appendOnce(entry),
  };

  const withTx: WithTx = async (fn) => {
    const tx: TxContext = { brand: "TxContext" } as unknown as TxContext;
    staging.set(tx, []);
    try {
      const ergebnis = await fn(tx);
      for (const op of staging.get(tx) ?? []) {
        op();
      }
      return ergebnis;
    } finally {
      staging.delete(tx);
    }
  };

  const schreiber = testschreiber(stage);
  const audit = new AuditService({ repo: auditRepo });
  const ko = new KoService({ repo: koRepo, audit, withTx, onPurgeTx: schreiber.hook });

  return { ko, audit, koInner, schreiber, deleteFehler, auditFehler };
}

async function seedGetrasht(ko: KoService, titel: string): Promise<string> {
  const angelegt = await ko.create({
    title: titel,
    statement: `Aussage zu ${titel}`,
    type: "best_practice",
    category: "Betrieb",
    author: "u1",
    tags: [],
  });
  await ko.delete(angelegt.id, "u1");
  return angelegt.id;
}

const purgeBelege = (eintraege: { action: string }[]): number =>
  eintraege.filter((e) => e.action === "ko.purged").length;

describe("JOB 1104 · S0-TX — der Haken laeuft IN der Transaktion", () => {
  it("A1 KALIBRIERUNG: Erfolgsfall — Aufraeumung wirkt, Zahl steht im ko.purged-Beleg", async () => {
    const { ko, audit, schreiber, koInner } = harness();
    const id = await seedGetrasht(ko, "Wartungsplan");
    schreiber.fuelle(id, 2);

    await ko.purgeTrashed(id, "u-admin");

    expect(schreiber.bestand.has(id)).toBe(false);
    expect(await koInner.findById(id)).toBeUndefined();
    const belege = (await audit.list()).filter((e) => e.action === "ko.purged");
    expect(belege).toHaveLength(1);
    expect(belege[0]?.payload).toMatchObject({ folgeartefakteGeloescht: 2 });
    expect(await audit.verify()).toBe(true);
  });

  it("A2 Aufraeumung gepuffert, dann scheitert repo.delete — NICHTS ist geschehen", async () => {
    const { ko, audit, schreiber, koInner, deleteFehler } = harness();
    const id = await seedGetrasht(ko, "Wartungsplan");
    schreiber.fuelle(id, 2);

    deleteFehler.arm();
    await expect(ko.purgeTrashed(id, "u-admin")).rejects.toThrow();

    // Die drei Zusagen zusammen: Folgeartefakte da, KO da, kein Beleg.
    expect(schreiber.bestand.get(id)).toBe(2);
    expect(await koInner.findById(id)).toBeDefined();
    expect(purgeBelege(await audit.list())).toBe(0);

    // Und der Vorgang ist nicht vergiftet: die Wiederholung ergibt A1.
    await ko.purgeTrashed(id, "u-admin");
    expect(schreiber.bestand.has(id)).toBe(false);
    expect(purgeBelege(await audit.list())).toBe(1);
  });

  it("A3 Aufraeumung und Delete gepuffert, dann scheitert audit.record — NICHTS ist geschehen", async () => {
    const { ko, audit, schreiber, koInner, auditFehler } = harness();
    const id = await seedGetrasht(ko, "Wartungsplan");
    schreiber.fuelle(id, 2);

    auditFehler.arm();
    await expect(ko.purgeTrashed(id, "u-admin")).rejects.toThrow();

    expect(schreiber.bestand.get(id)).toBe(2);
    expect(await koInner.findById(id)).toBeDefined();
    expect(purgeBelege(await audit.list())).toBe(0);
  });

  it("A4 die Aufraeumung selbst wirft — kein Delete, kein Beleg", async () => {
    const { ko, audit, schreiber, koInner } = harness();
    const id = await seedGetrasht(ko, "Wartungsplan");
    schreiber.fuelle(id, 2);

    schreiber.fehler.arm();
    await expect(ko.purgeTrashed(id, "u-admin")).rejects.toThrow();

    expect(schreiber.bestand.get(id)).toBe(2);
    expect(await koInner.findById(id)).toBeDefined();
    expect(purgeBelege(await audit.list())).toBe(0);
  });

  it("A7 GEGENPROBE: ohne Folgeartefakte — unveraendertes Verhalten, Zahl 0", async () => {
    const { ko, audit } = harness();
    const id = await seedGetrasht(ko, "Einzelstueck");

    await ko.purgeTrashed(id, "u-admin");

    const belege = (await audit.list()).filter((e) => e.action === "ko.purged");
    expect(belege).toHaveLength(1);
    expect(belege[0]?.payload).toMatchObject({ folgeartefakteGeloescht: 0 });
  });

  it("ohne verdrahteten Haken bleibt das Verhalten exakt wie bisher", async () => {
    const { ko, audit, koInner } = harness();
    // Ein zweiter Dienst auf demselben Bestand, aber OHNE onPurgeTx.
    const id = await seedGetrasht(ko, "Ohne Haken");
    const ohne = new KoService({
      repo: koInner,
      audit,
    });
    await ohne.purgeTrashed(id, "u-admin");

    expect(await koInner.findById(id)).toBeUndefined();
    const belege = (await audit.list()).filter((e) => e.action === "ko.purged");
    expect(belege).toHaveLength(1);
    // Kein erfundener Beitrag im Payload.
    expect(belege[0]?.payload).not.toHaveProperty("folgeartefakteGeloescht");
  });
});

describe("JOB 1104 · A6 — die Abgrenzung zum VORGESCHALTETEN Fenster", () => {
  // Das ist die alte D3-Zusage L5, jetzt an der richtigen Stelle: sie belegt Fenster (A) und
  // ausdruecklich NICHT die Atomaritaet. Der Unterschied ist der ganze Punkt dieser Scheibe.
  it("scheitert der vorgeschaltete onPurge, lief der transaktionsgebundene Haken GAR NICHT", async () => {
    const { ko, audit, schreiber, koInner } = harness();
    const id = await seedGetrasht(ko, "Wartungsplan");
    schreiber.fuelle(id, 2);
    ko.setPurgeCleanup(async () => {
      throw new Error("vorgeschalteter cleanup kaputt");
    });

    await expect(ko.purgeTrashed(id, "u-admin")).rejects.toThrow();

    expect(await koInner.findById(id)).toBeDefined();
    expect(purgeBelege(await audit.list())).toBe(0);
    // Der entscheidende Unterschied zu A4: hier wurde der Haken nicht einmal AUFGERUFEN.
    expect(schreiber.aufrufe()).toBe(0);
    expect(schreiber.bestand.get(id)).toBe(2);
  });
});

describe("JOB 1104 · A5 — Strukturorakel der Fallbackgrenze", () => {
  // D4 §2.5 nimmt den sequentiellen Fallback ausdruecklich von der Atomaritaetszusage aus, weil er
  // NUR in Kompositionen ohne echte Datenbank erreichbar ist. Diese Ausnahme ist nur so lange
  // ehrlich, wie jede Pg-Wurzel wirklich `withTx` mitgibt. Ohne dieses Orakel waere sie eine
  // Einladung, eines Tages einen zweiten Pg-Weg ohne `withTx` anzulegen — und die Zusage kippte
  // still.
  it("jede Kompositionswurzel, die Pg-Repos baut, gibt withTx mit", () => {
    const quelle = readFileSync(
      new URL("../../services/app/src/build-app.ts", import.meta.url),
      "utf8",
    );
    // Absicherung, dass der Scanner ueberhaupt etwas findet (sonst waere das Orakel wertlos).
    const pgWurzeln = [...quelle.matchAll(/new PgKoRepo\(/g)];
    expect(pgWurzeln.length).toBeGreaterThanOrEqual(1);
    // Jede Wurzel, die PgKoRepo konstruiert, muss im selben Aufbau `withTx` fuehren.
    expect(quelle).toContain("withTx:");
    expect(quelle).toMatch(/withTx:\s*\(fn\)\s*=>\s*withPgTx\(/);
  });

  it("die In-Memory-Wurzel gibt bewusst KEIN withTx — dort gibt es keine Transaktionsgrenze", () => {
    const quelle = readFileSync(
      new URL("../../services/app/src/build-app.ts", import.meta.url),
      "utf8",
    );
    const inMemoryAufbau = quelle.slice(
      quelle.indexOf("koRepo: new InMemoryKoRepo()"),
      quelle.indexOf("koRepo: new InMemoryKoRepo()") + 400,
    );
    expect(inMemoryAufbau).not.toContain("withPgTx");
  });
});

describe("JOB 1104 · A8 — die rollbackCreatedKo-Vorbedingung, benannt statt verschwiegen", () => {
  // D4 §2.6 hat einen dritten `repo.delete`-Aufrufer gemessen, der NICHT ueber `purgeKo` laeuft:
  // die Ruecknahme einer gescheiterten Erstanlage. Der Modulkommentar behauptete das Gegenteil.
  //
  // Fuer diese Scheibe ist das eine VORBEDINGUNG, kein Defekt: Ein KO, dessen Erstanlage
  // zurueckgenommen wird, muss frei von Folgeartefakten sein. Heute ist das erfuellt, weil vor dem
  // Abschluss von `create()` kein Weg existiert, ein Folgeartefakt daran zu haengen.
  //
  // Dieser Test haelt genau das fest — und wird rot, sobald jemand die Ruecknahme an den
  // transaktionsgebundenen Haken haengt ODER umgekehrt einen Weg baut, der waehrend der Erstanlage
  // Folgeartefakte anlegt. Beide Formen sind zulaessig (D4 §2.6: „beide sind zulaessig, das
  // Schweigen darueber nicht") — sie muessen nur entschieden werden, statt sich einzuschleichen.
  it("die Ruecknahme einer gescheiterten Erstanlage laeuft NICHT durch den Purge-Haken", async () => {
    const { schreiber, koInner } = harness();
    const scheiternd = new KoService({
      repo: koInner,
      onPurgeTx: schreiber.hook,
      // Ein Versions-Repo, dessen `append` wirft, laesst `create()` nach dem Insert scheitern —
      // genau die Lage, die `rollbackCreatedKo` ausloest.
      versions: {
        append: () => Promise.reject(new Error("versions kaputt")),
        listByKo: () => Promise.resolve([]),
        remove: () => Promise.resolve(),
      },
    });

    await expect(
      scheiternd.create({
        title: "Scheitert",
        statement: "Aussage",
        type: "best_practice",
        category: "Betrieb",
        author: "u1",
        tags: [],
      }),
    ).rejects.toThrow();

    // Der transaktionsgebundene Haken wurde NICHT aufgerufen: die Ruecknahme ist ein anderer Weg.
    expect(schreiber.aufrufe()).toBe(0);
  });
});
