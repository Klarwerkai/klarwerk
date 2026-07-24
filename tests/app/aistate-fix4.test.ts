// AUFTRAG-aistate-fix4 (bens V5-Auflage, 23.07.) — V5 STRUKTURELL geschlossen:
//  1. ATOMARE Aktivierung: Versionsprüfung + Insert in EINER Persistenzoperation
//     (repo.insertIfVersionsCurrent) — bei Abweichung wird GAR KEIN offener Datensatz committed.
//  2. Read-Pfad FAIL-CLOSED: unresolved() liefert keinen Befund, dessen gebundene KO-Version nicht
//     mehr der aktuellen entspricht (oder deren aktuelle Version nicht ermittelbar ist).
// Bens Test-Vorgaben, ECHT umgesetzt:
//  - Paralleltest: ein unresolved()-Leser liest in JEDEM Mikrotask-Fenster des stale Laufs — also
//    auch GENAU dort, wo der alte Code zwischen Insert und Kompensation einen offenen stale Befund
//    sichtbar machte — und sieht NIE einen (Konflikt UND Overlap; nicht nur der Endzustand).
//  - Audit-Fehler/-Hänger NACH dem (früheren) Insert-Punkt: trotzdem NULL offene stale Befunde —
//    der atomare Insert hinterlässt gar keinen Datensatz; der Read-Filter blendet Reste aus.
import { describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import type { AuditService } from "../../services/audit";
import {
  ConflictService,
  type ConflictVerdict,
  type DetectSubject,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
  type OverlapVerdict,
} from "../../services/conflicts";

// Wortgleiche Kerntexte → deterministischer Overlap-Treffer (der Judge wird trotzdem konsultiert).
function overlapSub(refId: string, version: number): DetectSubject {
  return {
    refId,
    title: "Pumpe entlüften",
    statement: "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.",
    conditions: [],
    measures: [],
    category: "Wartung",
    tags: [],
    asset: null,
    version,
  };
}

function conflictSub(refId: string, statement: string, version: number): DetectSubject {
  return {
    refId,
    title: `Ventil ${refId}`,
    statement,
    conditions: [],
    measures: [],
    category: "K",
    tags: [],
    asset: null,
    version,
  };
}

const WIDERSPRUCH: ConflictVerdict = {
  relation: "widerspruch",
  older: null,
  confidence: 0.9,
  begruendung: "Farbwiderspruch",
  zitat_a: "Das Ventil ist blau",
  zitat_b: "Das Ventil ist rot",
};

// Test-eigener KO-Versionsstand: synchron änderbar wie eine echte Revision, gleiche Autorität für
// Schreibschutz (isCurrent) und Read-Filter (currentVersion) — so wie der App-Root beides an den
// KO-Store bindet.
function versionStore(init: Record<string, number>) {
  const versions = new Map(Object.entries(init));
  return {
    versions,
    isCurrent: async (koId: string, version: number) => versions.get(koId) === version,
    currentVersion: async (koId: string) => versions.get(koId),
  };
}

// Paralleler unresolved()-Leser: liest in JEDEM Mikrotask-Fenster, bis stop() aufgerufen wird.
// Genau dieses Raster deckt das frühere Insert-/Kompensations-Fenster ab (alle Persistenz- und
// Audit-Schritte der In-Memory-Kette sind Mikrotask-getaktet).
function windowReader(read: () => Promise<number>) {
  let done = false;
  let reads = 0;
  let sichtbar = 0;
  const loop = (async () => {
    while (!done) {
      const open = await read();
      reads += 1;
      if (open > 0) {
        sichtbar += 1;
      }
      await Promise.resolve();
    }
  })();
  return {
    stop: async () => {
      done = true;
      await loop;
      return { reads, sichtbar };
    },
  };
}

describe("aistate-fix4 · Paralleltest: Read GENAU im früheren Insert-/Kompensations-Fenster (Overlap)", () => {
  it("stale Lauf (Revision während der Judge hängt) ⇒ zu KEINEM Zeitpunkt ein offener stale Befund sichtbar, GAR KEIN Datensatz committed", async () => {
    const repo = new InMemoryOverlapRepo();
    const store = versionStore({ a: 1, b: 1 });
    const svc = new OverlapService({ repo, currentVersion: store.currentVersion });

    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const judge = async (): Promise<OverlapVerdict | null> => {
      await gate; // der Judge hängt, bis der Test ihn freigibt
      return null; // kein Modell-Urteil — der deterministische Treffer würde anlegen wollen
    };

    const run = svc.detectForSubject(overlapSub("a", 1), [overlapSub("b", 1)], judge, {
      isCurrent: store.isCurrent,
    });
    // Revision landet, WÄHREND der alte Lauf im Judge hängt — der Lauf ist ab jetzt stale.
    store.versions.set("b", 2);

    const reader = windowReader(async () => (await svc.unresolved()).length);
    (release as unknown as () => void)();
    const created = await run;
    const { reads, sichtbar } = await reader.stop();

    expect(created).toHaveLength(0);
    // Kern des Paralleltests: der Leser lief WÄHREND des Laufs (nicht erst am Endzustand) …
    expect(reads).toBeGreaterThan(0);
    // … und hat in KEINEM Fenster einen offenen stale Befund gesehen.
    expect(sichtbar).toBe(0);
    // Atomare Aktivierung: es wurde GAR KEIN Datensatz committed (auch kein geschlossener).
    expect(await repo.all()).toHaveLength(0);
  });
});

describe("aistate-fix4 · Paralleltest: Read GENAU im früheren Insert-/Kompensations-Fenster (Konflikt)", () => {
  it("stale Lauf ⇒ zu KEINEM Zeitpunkt ein offener stale Konflikt sichtbar, GAR KEIN Datensatz committed", async () => {
    const repo = new InMemoryConflictRepo();
    const store = versionStore({ a: 1, b: 1 });
    const svc = new ConflictService({ repo, currentVersion: store.currentVersion });

    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const judge = async (): Promise<ConflictVerdict | null> => {
      await gate;
      return WIDERSPRUCH; // anlegendes Urteil — kehrt aber erst NACH der Revision zurück
    };

    const run = svc.detectForSubject(
      conflictSub("a", "Das Ventil ist blau.", 1),
      [conflictSub("b", "Das Ventil ist rot.", 1)],
      judge,
      { isCurrent: store.isCurrent },
    );
    store.versions.set("b", 2);

    const reader = windowReader(async () => (await svc.unresolved()).length);
    (release as unknown as () => void)();
    const created = await run;
    const { reads, sichtbar } = await reader.stop();

    expect(created).toHaveLength(0);
    expect(reads).toBeGreaterThan(0);
    expect(sichtbar).toBe(0);
    expect(await repo.all()).toHaveLength(0);
  });
});

describe("aistate-fix4 · Audit-Fehler/-Hänger nach dem (früheren) Insert-Punkt", () => {
  it("Konflikt, bens Gegenbeispiel: Revision vor dem Insert + Audit fällt aus ⇒ NULL Datensätze, das Anlage-Audit wird nie erreicht", async () => {
    const repo = new InMemoryConflictRepo();
    const store = versionStore({ a: 1, b: 1 });
    const audited: string[] = [];
    const audit = {
      record: async (e: { action: string }) => {
        audited.push(e.action);
        if (e.action === "conflict.auto-created") {
          throw new Error("Audit-Ausfall"); // im alten Code blieb der stale Befund dadurch DAUERHAFT offen
        }
      },
    } as unknown as AuditService;
    const svc = new ConflictService({ repo, audit, currentVersion: store.currentVersion });

    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const judge = async (): Promise<ConflictVerdict | null> => {
      await gate;
      return WIDERSPRUCH;
    };
    const run = svc.detectForSubject(
      conflictSub("a", "Das Ventil ist blau.", 1),
      [conflictSub("b", "Das Ventil ist rot.", 1)],
      judge,
      { isCurrent: store.isCurrent },
    );
    store.versions.set("b", 2); // Revision — der Lauf wird stale
    (release as unknown as () => void)();
    const created = await run;

    expect(created).toHaveLength(0);
    // Der atomare Insert hat GAR KEINEN Datensatz hinterlassen — nichts, was ein Audit-Ausfall
    // offen zurücklassen könnte; das Anlage-Audit wurde folgerichtig nie aufgerufen.
    expect(await repo.all()).toHaveLength(0);
    expect(await svc.unresolved()).toHaveLength(0);
    expect(audited).not.toContain("conflict.auto-created");
  });

  it("Overlap: Audit HÄNGT nach einem legitimen Insert, dann Revision ⇒ Read-Filter blendet sofort aus, Sweep schließt aktiv — nie ein offener stale Befund", async () => {
    const repo = new InMemoryOverlapRepo();
    const store = versionStore({ a: 1, b: 1 });
    let releaseAudit: (() => void) | null = null;
    const auditGate = new Promise<void>((r) => {
      releaseAudit = r;
    });
    let enteredAudit: (() => void) | null = null;
    const entered = new Promise<void>((r) => {
      enteredAudit = r;
    });
    const audit = {
      record: async (e: { action: string }) => {
        if (e.action === "overlap.auto-created") {
          (enteredAudit as unknown as () => void)();
          await auditGate; // das Audit hängt UNBEGRENZT — genau bens Hänger-Szenario
        }
      },
    } as unknown as AuditService;
    const svc = new OverlapService({ repo, audit, currentVersion: store.currentVersion });

    const noJudge = async (): Promise<OverlapVerdict | null> => null;
    const run = svc.detectForSubject(overlapSub("a", 1), [overlapSub("b", 1)], noJudge, {
      isCurrent: store.isCurrent,
    });
    await entered; // der Lauf hängt jetzt IM Audit — der (legitime) Insert ist bereits committed
    expect((await repo.all()).filter((e) => e.status !== "geschlossen")).toHaveLength(1);

    // JETZT die Revision: der committete Befund ist ab sofort stale.
    store.versions.set("b", 2);
    // Read-Filter (fail-closed) blendet ihn SOFORT aus — noch vor jedem Sweep, trotz hängendem Audit.
    expect(await svc.unresolved()).toHaveLength(0);
    expect(await svc.badgeCount()).toBe(0);
    // Der Revisions-Sweep schließt ihn zusätzlich aktiv (idempotent zum Filter).
    expect(await svc.onKoRevised("b", 2)).toBe(1);
    expect((await repo.all()).filter((e) => e.status !== "geschlossen")).toHaveLength(0);

    (releaseAudit as unknown as () => void)();
    await run;
    expect(await svc.unresolved()).toHaveLength(0);
  });
});

describe("aistate-fix4 · Read-Pfad fail-closed über die ECHTEN Routen", () => {
  async function appWithUser(services: AppServices) {
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "p@x.de", password: "secret123" },
    });
    return {
      app,
      headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
    };
  }

  it("ein per Alt-/Fehlerzustand entstandener stale Befund taucht NIE in Board/Badge auf; Altbestand ohne Versionsfelder bleibt sichtbar", async () => {
    const services = buildServices();
    const { app, headers } = await appWithUser(services);
    const a = await services.ko.create({
      type: "best_practice",
      category: "K",
      author: "u1",
      title: "Ventilfarbe Anlage 3",
      statement: "Das Ventil ist rot.",
    });
    const b = await services.ko.create({
      type: "best_practice",
      category: "K",
      author: "u1",
      title: "Ventilkennzeichnung Halle",
      statement: "Das Ventil ist blau.",
    });

    // Simulierter Fehlerzustand aus der Vor-fix4-Welt: ein OFFENER Befund, dessen gebundene
    // Version NIE der aktuellen entspricht (direkt am Gate vorbei über createAuto persistiert).
    await services.conflicts.createAuto(
      {
        koA: a.id,
        koB: b.id,
        type: "truth",
        description: "stale Altlauf",
        koAVersion: a.version,
        koBVersion: (b.version ?? 1) + 7,
      },
      { trigger: "validation", method: "model" },
    );
    // Befund an ein nicht (mehr) existierendes KO gebunden → aktuelle Version NICHT ermittelbar.
    await services.overlaps.createAuto(
      {
        koA: "geist-ko",
        koB: b.id,
        relation: "identisch",
        aspects: [],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
        koAVersion: 1,
        koBVersion: b.version,
      },
      { trigger: "validation", method: "deterministic", lexicalScore: 1 },
    );

    // FAIL-CLOSED: beide stale Befunde werden weder vom Service noch von den Routen geliefert.
    expect(await services.conflicts.unresolved()).toHaveLength(0);
    expect(await services.conflicts.badgeCount()).toBe(0);
    expect(await services.overlaps.unresolved()).toHaveLength(0);
    expect(await services.overlaps.badgeCount()).toBe(0);
    const conflictBoard = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(conflictBoard.json()).toEqual([]);
    const duplicateBoard = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(duplicateBoard.json()).toEqual([]);

    // Altbestand OHNE Versionsfelder bleibt konservativ sichtbar (keine Regression für Vor-fix2-Daten).
    await services.conflicts.createAuto(
      { koA: a.id, koB: b.id, type: "truth", description: "Altbestand ohne Versionsbindung" },
      { trigger: "validation", method: "model" },
    );
    const board = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    const sichtbar = board.json() as Array<{ description: string }>;
    expect(sichtbar).toHaveLength(1);
    expect(sichtbar[0]?.description).toBe("Altbestand ohne Versionsbindung");
    expect(await services.conflicts.badgeCount()).toBe(1);

    // Ein AKTUELL gebundener Befund bleibt selbstverständlich sichtbar (kein Über-Filtern).
    await services.overlaps.createAuto(
      {
        koA: a.id,
        koB: b.id,
        relation: "identisch",
        aspects: [],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
        koAVersion: a.version,
        koBVersion: b.version,
      },
      { trigger: "validation", method: "deterministic", lexicalScore: 1 },
    );
    expect(await services.overlaps.unresolved()).toHaveLength(1);
  });
});
