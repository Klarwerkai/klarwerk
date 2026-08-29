// ================================================================================================
// JOB 2704 D1 (Review R2-35) — VIER SCHRITTE, EINE TRANSAKTION: der Nachweis ist ein Abbruch.
// ================================================================================================
//
// DER BEFUND: `mutateKoTx` schrieb kos-UPDATE, ko_versions-INSERT, Suchprojektion und Audit in vier
// getrennten Transaktionen; zusammengehalten nur durch eine Kompensation im `catch`. Ein ABBRUCH
// (Prozess stirbt, Verbindung weg) zwischen Schritt 1 und 2 laesst keinen `catch` mehr laufen —
// Version n+1 steht im Bestand, ohne Snapshot, ohne Projektion, und nichts meldet es je.
//
// DIESE DATEI MISST DREI DINGE, in dieser Reihenfolge:
//   A  den Befund selbst, auf dem alten Weg (ohne `withTx`): nach Schritt 1 stirbt die Verbindung —
//      und Version n+1 steht ohne Snapshot da. Ohne diesen Fall waere B nur behauptet.
//   B  den Bau: mit `withTx` laufen alle vier Schritte auf EINEM Transaktionskontext; ein Abbruch
//      an JEDER Stelle (nach 1, nach 2, nach 3, vor dem Commit) hinterlaesst NICHTS — und die
//      Kompensation wird dabei NICHT gerufen (zwei Sicherungen fuer denselben Fall waeren zwei).
//   C  die Gegenprobe: ohne Abbruch committen alle vier — und ohne `withTx` (InMemory/Journal)
//      traegt die alte Kompensation weiter.
//
// Die Transaktion ist hier eine ATTRAPPE nach dem Muster von tests/ko/kante-purge-atomar.test.ts:
// Schreiber, die einen `tx` bekommen, legen ihre Wirkung ab und fuehren sie erst beim Commit aus;
// wirft der Koerper, wird nichts ausgefuehrt. Genau so verhaelt sich Postgres unter `withPgTx`
// (BEGIN … COMMIT/ROLLBACK). Die Pg-Adapter selbst sind in job2704-pg-vier-schreiber-ein-client
// gepinnt.
import { describe, expect, it, vi } from "vitest";
import type { AuditRepo } from "../../services/audit/src/repo";
import { InMemoryAuditRepo } from "../../services/audit/src/repo";
import { AuditService } from "../../services/audit/src/service";
import type { TxContext } from "../../services/db-tx";
import type { KoMetadataProjectionRepo } from "../../services/knowledge-object/src/metadata-projection-repo";
import {
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  type KoRepo,
  type KoVersionRepo,
} from "../../services/knowledge-object/src/repo";
import {
  InMemoryKoSearchProjectionRepo,
  type KoSearchProjectionRepo,
} from "../../services/knowledge-object/src/search-projection-repo";
import { KoService, type WithTx } from "../../services/knowledge-object/src/service";

type Op = () => Promise<void> | void;

const EINGABE = {
  title: "Spezialpresse SPX9",
  statement: "Kurzfassung.",
  type: "best_practice" as const,
  category: "Wartung",
  author: "anna",
  bodyHtml: "<p>BESTANDSWORT</p>",
};

/**
 * Die Transaktionsattrappe: `withTx` legt je Aufruf einen Kontext an; Schreiber, die ihn bekommen,
 * staffeln ihre Wirkung. Laeuft der Koerper durch, werden die Wirkungen in Reihenfolge ausgefuehrt
 * (Commit); wirft er, werden sie verworfen (Rollback). `stirbtVorCommit` simuliert den Abbruch, den
 * der Befund meint: der Koerper ist durch, aber der Commit erreicht die Datenbank nie.
 */
function transaktionsAttrappe() {
  const staging = new WeakMap<TxContext, Op[]>();
  const zaehler = { begonnen: 0, committet: 0, verworfen: 0 };
  const gesehen: TxContext[] = [];
  let stirbtVorCommit = false;
  const withTx: WithTx = async (fn) => {
    const tx = { brand: "TxContext" } as TxContext;
    staging.set(tx, []);
    zaehler.begonnen += 1;
    try {
      const wert = await fn(tx);
      if (stirbtVorCommit) {
        throw new Error("Verbindung zur Datenbank vor COMMIT verloren");
      }
      for (const op of staging.get(tx) ?? []) {
        await op();
      }
      zaehler.committet += 1;
      return wert;
    } catch (err) {
      zaehler.verworfen += 1;
      throw err;
    }
  };
  function stage(tx: TxContext | undefined, op: Op): Promise<void> {
    if (tx) {
      gesehen.push(tx);
      const ops = staging.get(tx);
      if (!ops) {
        throw new Error("fremder TxContext");
      }
      ops.push(op);
      return Promise.resolve();
    }
    return Promise.resolve(op());
  }
  return {
    withTx,
    stage,
    zaehler,
    gesehen,
    stirb: () => {
      stirbtVorCommit = true;
    },
  };
}

function aufbau(opts: { mitTx: boolean } = { mitTx: true }) {
  const attrappe = transaktionsAttrappe();
  const koInner = new InMemoryKoRepo();
  const versionsInner = new InMemoryKoVersionRepo();
  const projectionsInner = new InMemoryKoSearchProjectionRepo(koInner);
  const auditInner = new InMemoryAuditRepo();
  const rufe = { update: 0, versionsRemove: 0, projectionsRemove: 0, rollbackUpdate: 0 };
  const fehler = { versionsAppend: false, audit: false, metadata: false, versionsHaengt: false };

  const repo = new Proxy(koInner, {
    get(ziel, name, empfaenger) {
      if (name === "update") {
        return (ko: Parameters<KoRepo["update"]>[0], tx?: TxContext) => {
          rufe.update += 1;
          return attrappe.stage(tx, () => ziel.update(ko));
        };
      }
      return Reflect.get(ziel, name, empfaenger);
    },
  }) as unknown as KoRepo;

  const versions = new Proxy(versionsInner, {
    get(ziel, name, empfaenger) {
      if (name === "append") {
        return (s: Parameters<KoVersionRepo["append"]>[0], tx?: TxContext) => {
          if (fehler.versionsHaengt) {
            return new Promise<void>(() => undefined);
          }
          if (fehler.versionsAppend) {
            return Promise.reject(new Error("ko_versions nicht erreichbar"));
          }
          return attrappe.stage(tx, () => ziel.append(s));
        };
      }
      if (name === "remove") {
        return (koId: string, version: number) => {
          rufe.versionsRemove += 1;
          return ziel.remove(koId, version);
        };
      }
      return Reflect.get(ziel, name, empfaenger);
    },
  }) as unknown as KoVersionRepo;

  const metadata = new Proxy(projectionsInner.metadata, {
    get(ziel, name, empfaenger) {
      if (name === "upsert") {
        return async (input: Parameters<KoMetadataProjectionRepo["upsert"]>[0], tx?: TxContext) => {
          if (fehler.metadata) {
            throw new Error("Metadatenspeicher nicht erreichbar");
          }
          if (!tx) {
            return ziel.upsert(input);
          }
          await attrappe.stage(tx, async () => {
            await ziel.upsert(input);
          });
          const vorher = await ziel.find(input.koId);
          return {
            projection: {
              koId: input.koId,
              categoryText: input.categoryText,
              tagText: input.tagText,
              metadataRevision: (vorher?.metadataRevision ?? 0) + 1,
              updatedAt: input.at,
            },
            previous: vorher,
            changed: true,
          };
        };
      }
      return Reflect.get(ziel, name, empfaenger);
    },
  });

  const projections = new Proxy(projectionsInner, {
    get(ziel, name, empfaenger) {
      if (name === "metadata") {
        return metadata;
      }
      if (name === "insert") {
        return async (p: Parameters<KoSearchProjectionRepo["insert"]>[0], tx?: TxContext) => {
          if (!tx) {
            return ziel.insert(p);
          }
          await attrappe.stage(tx, async () => {
            await ziel.insert(p);
          });
          return true;
        };
      }
      if (name === "remove") {
        return (koId: string, version: number, o?: { ruecknahme?: boolean }) => {
          rufe.projectionsRemove += 1;
          return ziel.remove(koId, version, o);
        };
      }
      return Reflect.get(ziel, name, empfaenger);
    },
  }) as unknown as KoSearchProjectionRepo;

  const auditRepo: AuditRepo = {
    append: (entry, tx) => {
      if (fehler.audit) {
        return Promise.reject(new Error("Audit-Speicher nicht erreichbar"));
      }
      return attrappe.stage(tx, () => auditInner.append(entry));
    },
    appendOnce: (entry, tx) => auditInner.appendOnce(entry, tx),
    all: () => auditInner.all(),
    last: (tx) => auditInner.last(tx),
  };
  const audit = new AuditService({ repo: auditRepo });

  const ko = new KoService({
    repo,
    versions,
    audit,
    searchProjections: projections,
    ...(opts.mitTx ? { withTx: attrappe.withTx } : {}),
  });
  return { ko, koInner, versionsInner, projectionsInner, auditInner, attrappe, rufe, fehler };
}

async function angelegt(h: ReturnType<typeof aufbau>) {
  await h.ko.activateSearchProjectionV2();
  const erstellt = await h.ko.create(EINGABE);
  // Nach der Anlage: exakt EINE Version, EINE Projektion — der Ausgangszustand jeder Messung.
  expect(erstellt.version).toBe(1);
  expect((await h.versionsInner.listByKo(erstellt.id)).map((v) => v.version)).toEqual([1]);
  expect((await h.projectionsInner.listByKo(erstellt.id)).map((p) => p.koVersion)).toEqual([1]);
  h.rufe.update = 0;
  return erstellt;
}

/** Der Zustand, den der Befund verbietet: Version n+1 im Bestand, aber kein Snapshot dazu. */
async function halbGespeichert(h: ReturnType<typeof aufbau>, id: string): Promise<boolean> {
  const ko = await h.koInner.findById(id);
  const versionen = (await h.versionsInner.listByKo(id)).map((v) => v.version);
  return ko !== undefined && !versionen.includes(ko.version);
}

async function ticks(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe("JOB 2704 D1 · A · DER BEFUND, GEMESSEN — ohne Transaktion (der Weg bis 2704)", () => {
  it("A1 · stirbt die Verbindung nach Schritt 1, steht Version 2 im Bestand OHNE Snapshot und OHNE Projektion — kein catch laeuft, nichts meldet es", async () => {
    const h = aufbau({ mitTx: false });
    const erstellt = await angelegt(h);
    // „Die Verbindung stirbt": der Snapshot-INSERT kommt nie zurueck. Kein Fehler, kein catch.
    h.fehler.versionsHaengt = true;
    void h.ko.revise(erstellt.id, { bodyHtml: "<p>HALBWORT</p>" }, "anna").catch(() => undefined);
    await ticks(10);
    expect(await halbGespeichert(h, erstellt.id)).toBe(true);
    const ko = await h.koInner.findById(erstellt.id);
    expect(ko?.version).toBe(2);
    expect(ko?.bodyHtml).toContain("HALBWORT");
    expect((await h.versionsInner.listByKo(erstellt.id)).map((v) => v.version)).toEqual([1]);
    expect((await h.projectionsInner.listByKo(erstellt.id)).map((p) => p.koVersion)).toEqual([1]);
    expect((await h.auditInner.all()).filter((e) => e.action === "ko.revised")).toHaveLength(0);
  });
});

describe("JOB 2704 D1 · B · DER BAU — mit withTx hinterlaesst ein Abbruch an jeder Stelle NICHTS", () => {
  async function erwarteUnveraendert(h: ReturnType<typeof aufbau>, id: string) {
    const ko = await h.koInner.findById(id);
    expect(ko?.version).toBe(1);
    expect(ko?.bodyHtml).toContain("BESTANDSWORT");
    expect(ko?.bodyHtml).not.toContain("VERWORFENWORT");
    expect(await halbGespeichert(h, id)).toBe(false);
    expect((await h.versionsInner.listByKo(id)).map((v) => v.version)).toEqual([1]);
    expect((await h.projectionsInner.listByKo(id)).map((p) => p.koVersion)).toEqual([1]);
    expect((await h.auditInner.all()).filter((e) => e.action === "ko.revised")).toHaveLength(0);
    // KEINE Kompensation: genau EIN update (kein rollbackKo), kein remove auf Snapshot/Projektion.
    expect(h.rufe.update).toBe(1);
    expect(h.rufe.versionsRemove).toBe(0);
    expect(h.rufe.projectionsRemove).toBe(0);
    expect(h.attrappe.zaehler).toEqual({ begonnen: 1, committet: 0, verworfen: 1 });
  }

  it("B1 · ABBRUCH ZWISCHEN SCHRITT 1 UND 2 (Snapshot scheitert): nichts geschrieben — nicht Version 2 ohne Snapshot", async () => {
    const h = aufbau();
    const erstellt = await angelegt(h);
    h.fehler.versionsAppend = true;
    await expect(
      h.ko.revise(erstellt.id, { bodyHtml: "<p>VERWORFENWORT</p>" }, "anna"),
    ).rejects.toThrow(/ko_versions nicht erreichbar/);
    await erwarteUnveraendert(h, erstellt.id);
  });

  it("B2 · Abbruch nach Schritt 3 (Metadatenhaelfte der Projektion scheitert): nichts geschrieben", async () => {
    const h = aufbau();
    const erstellt = await angelegt(h);
    h.fehler.metadata = true;
    await expect(
      h.ko.revise(erstellt.id, { bodyHtml: "<p>VERWORFENWORT</p>" }, "anna"),
    ).rejects.toThrow(/Metadatenspeicher/);
    await erwarteUnveraendert(h, erstellt.id);
  });

  it("B3 · Abbruch im Audit (Schritt 4): nichts geschrieben — kein Stand ohne Beleg", async () => {
    const h = aufbau();
    const erstellt = await angelegt(h);
    h.fehler.audit = true;
    await expect(
      h.ko.revise(erstellt.id, { bodyHtml: "<p>VERWORFENWORT</p>" }, "anna"),
    ).rejects.toThrow(/Audit-Speicher/);
    await erwarteUnveraendert(h, erstellt.id);
  });

  it("B4 · DER FALL DES BEFUNDS: alle vier Schritte sind durch, der Commit erreicht die Datenbank nie — nichts geschrieben, kein Beleg ohne Aenderung", async () => {
    const h = aufbau();
    const erstellt = await angelegt(h);
    h.attrappe.stirb();
    await expect(
      h.ko.revise(erstellt.id, { bodyHtml: "<p>VERWORFENWORT</p>" }, "anna"),
    ).rejects.toThrow(/vor COMMIT verloren/);
    await erwarteUnveraendert(h, erstellt.id);
  });
});

describe("JOB 2704 D1 · C · GEGENPROBEN", () => {
  it("C1 · KALIBRIERUNG: ohne Abbruch committen alle vier Schritte — auf EINEM Kontext, in EINER Klammer", async () => {
    const h = aufbau();
    const erstellt = await angelegt(h);
    const revidiert = await h.ko.revise(erstellt.id, { bodyHtml: "<p>NEUWORT</p>" }, "anna");
    expect(revidiert.version).toBe(2);
    expect((await h.koInner.findById(erstellt.id))?.bodyHtml).toContain("NEUWORT");
    expect((await h.versionsInner.listByKo(erstellt.id)).map((v) => v.version)).toEqual([1, 2]);
    expect((await h.projectionsInner.listByKo(erstellt.id)).map((p) => p.koVersion)).toEqual([
      1, 2,
    ]);
    expect((await h.projectionsInner.metadata.find(erstellt.id))?.koId).toBe(erstellt.id);
    expect((await h.auditInner.all()).filter((e) => e.action === "ko.revised")).toHaveLength(1);
    expect(h.attrappe.zaehler).toEqual({ begonnen: 1, committet: 1, verworfen: 0 });
    // Alle Schreiber (kos, ko_versions, Projektion Inhalt + Metadaten, Audit) sahen DENSELBEN Kontext.
    expect(h.attrappe.gesehen).toHaveLength(5);
    expect(new Set(h.attrappe.gesehen).size).toBe(1);
    expect(h.rufe.update).toBe(1);
  });

  it("C2 · die Suche findet die neue Fassung — und nach einem Abbruch weiterhin nur die alte", async () => {
    const h = aufbau();
    const erstellt = await angelegt(h);
    h.fehler.versionsAppend = true;
    await expect(
      h.ko.revise(erstellt.id, { bodyHtml: "<p>VERWORFENWORT</p>" }, "anna"),
    ).rejects.toThrow();
    expect((await h.ko.findSearchHits({ terms: ["bestandswort"] })).map((t) => t.koId)).toEqual([
      erstellt.id,
    ]);
    expect(await h.ko.findSearchHits({ terms: ["verworfenwort"] })).toEqual([]);
    h.fehler.versionsAppend = false;
    await h.ko.revise(erstellt.id, { bodyHtml: "<p>GUELTIGWORT</p>" }, "anna");
    expect((await h.ko.findSearchHits({ terms: ["gueltigwort"] })).map((t) => t.koId)).toEqual([
      erstellt.id,
    ]);
    expect(await h.ko.findSearchHits({ terms: ["verworfenwort"] })).toEqual([]);
  });

  it("C3 · OHNE withTx (InMemory, Dev-Journal) traegt die alte Kompensation weiter: Snapshot scheitert, der Stand wird zurueckgerollt", async () => {
    const h = aufbau({ mitTx: false });
    const erstellt = await angelegt(h);
    h.fehler.versionsAppend = true;
    await expect(
      h.ko.revise(erstellt.id, { bodyHtml: "<p>VERWORFENWORT</p>" }, "anna"),
    ).rejects.toThrow(/ko_versions nicht erreichbar/);
    const ko = await h.koInner.findById(erstellt.id);
    expect(ko?.version).toBe(1);
    expect(ko?.bodyHtml).toContain("BESTANDSWORT");
    expect(await halbGespeichert(h, erstellt.id)).toBe(false);
    // Hier laeuft die Kompensation — zwei updates (Persist + rollbackKo), kein Transaktionskontext.
    expect(h.rufe.update).toBe(2);
    expect(h.attrappe.zaehler.begonnen).toBe(0);
    expect(h.attrappe.gesehen).toHaveLength(0);
  });

  it("C4 · Kalibrierung des Befundsatzes: die Kompensation faengt einen FEHLER, keinen ABBRUCH — deshalb reicht sie nicht", async () => {
    // Derselbe Aufbau wie A1, aber mit Fehler statt Verbindungsverlust: die Kompensation greift.
    const h = aufbau({ mitTx: false });
    const erstellt = await angelegt(h);
    h.fehler.versionsAppend = true;
    await expect(h.ko.revise(erstellt.id, { bodyHtml: "<p>X</p>" }, "anna")).rejects.toThrow();
    expect(await halbGespeichert(h, erstellt.id)).toBe(false);
    expect(vi.isMockFunction(h.ko.revise)).toBe(false);
  });
});
