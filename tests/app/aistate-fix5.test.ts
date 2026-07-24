// AUFTRAG-aistate-fix5 (Pedi D-V5=b, 23.07.) — V5 VIP-sauber über die Read-Seite geschlossen:
//  1. GEMEINSAMER fail-closed Versions-Helfer (version-guard) für unresolved() UND get() — damit
//     liefert KEIN aktiver Lesepfad (Liste, Badge, Benachrichtigung, Detail-Route) einen stale
//     gebundenen offenen Befund aus (bens ROT 2: die Detail-Routen sind geschlossen ⇒ 404).
//  2. Lese-GC: ein SICHER stale gebundener OFFENER Befund (Karteileiche aus dem bewusst nicht
//     serialisierten Schreib-Race — Pedi D-V5=b, Post-VIP-Job-Queue) wird beim Lesen best-effort
//     idempotent systemisch geschlossen (superseded, by=null, analog onKoRevised).
//  3. Gegenproben: Altbestand ohne Versionsfelder und aktuell gebundene Befunde bleiben sichtbar;
//     bei NICHT ermittelbarer aktueller Version wird ausgeblendet, aber NICHT geschlossen.
import { describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import type { AuditService } from "../../services/audit";
import {
  ConflictService,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
} from "../../services/conflicts";

// Test-eigener KO-Versionsstand (Muster aistate-fix4): synchron änderbar wie eine echte Revision.
function versionStore(init: Record<string, number>) {
  const versions = new Map(Object.entries(init));
  return {
    versions,
    currentVersion: async (koId: string) => versions.get(koId),
  };
}

// Der Lese-GC feuert als Makrotask (blockiert den Read nicht) — ein Timer-Durchlauf lässt alle
// zuvor angestoßenen GC-Ketten (reine Mikrotask-Persistenz in-memory) vollständig abschließen.
function flushGc(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function captureAudit(actions: string[]): AuditService {
  return {
    record: async (e: { action: string }) => {
      actions.push(e.action);
    },
  } as unknown as AuditService;
}

describe("aistate-fix5 · fail-closed Read-Pfad + Lese-GC (Konflikt)", () => {
  it("stale gebundener OFFENER Konflikt: unsichtbar über unresolved() UND get(); der GC schließt ihn idempotent (superseded), ein zweiter Read findet ihn geschlossen", async () => {
    const repo = new InMemoryConflictRepo();
    const store = versionStore({ a: 1, b: 1 });
    const audited: string[] = [];
    const svc = new ConflictService({
      repo,
      audit: captureAudit(audited),
      currentVersion: store.currentVersion,
    });
    const stale = await svc.createAuto(
      {
        koA: "a",
        koB: "b",
        type: "truth",
        description: "Karteileiche aus dem Schreib-Race",
        koAVersion: 1,
        koBVersion: 1,
      },
      { trigger: "validation", method: "model" },
    );
    // Revision NACH der Anlage: der offene Befund ist ab jetzt SICHER stale gebunden.
    store.versions.set("b", 2);

    // Kein aktiver Lesepfad liefert ihn aus — Liste, Badge UND Detail (get ⇒ Route 404).
    expect(await svc.unresolved()).toHaveLength(0);
    expect(await svc.badgeCount()).toBe(0);
    expect(await svc.get(stale.id)).toBeUndefined();

    // Lese-GC: die Karteileiche ist jetzt systemisch geschlossen (superseded, by=null).
    await flushGc();
    const closed = await repo.findById(stale.id);
    expect(closed?.status).toBe("geloest");
    expect(closed?.resolutionReason).toBe("superseded");
    expect(closed?.decidedBy).toBeNull();

    // Zweiter Read: findet ihn GESCHLOSSEN — nie als offenen Befund.
    expect(await svc.unresolved()).toHaveLength(0);
    expect((await svc.get(stale.id))?.status).toBe("geloest");

    // Idempotent: drei Reads vor dem GC-Lauf ⇒ trotzdem genau EIN systemischer Abschluss.
    expect(audited.filter((a) => a === "conflict.superseded")).toHaveLength(1);
    await flushGc();
    expect(audited.filter((a) => a === "conflict.superseded")).toHaveLength(1);
  });

  it("nicht ermittelbare aktuelle Version (Geist-KO): fail-closed ausgeblendet, aber KEIN GC — der Befund bleibt offen", async () => {
    const repo = new InMemoryConflictRepo();
    const store = versionStore({ b: 1 }); // „geist" ist der Versions-Autorität unbekannt
    const audited: string[] = [];
    const svc = new ConflictService({
      repo,
      audit: captureAudit(audited),
      currentVersion: store.currentVersion,
    });
    const geist = await svc.createAuto(
      {
        koA: "geist",
        koB: "b",
        type: "truth",
        description: "Bindung an nicht ermittelbares KO",
        koAVersion: 1,
        koBVersion: 1,
      },
      { trigger: "validation", method: "model" },
    );

    expect(await svc.unresolved()).toHaveLength(0);
    expect(await svc.get(geist.id)).toBeUndefined();

    // Ein transienter Lookup-Ausfall darf keinen Befund beenden: NICHT geschlossen, nur unsichtbar.
    await flushGc();
    expect((await repo.findById(geist.id))?.status).toBe("offen");
    expect(audited).not.toContain("conflict.superseded");
  });

  it("Gegenprobe: Altbestand ohne Versionsfelder und aktuell gebundene Befunde bleiben über unresolved() UND get() sichtbar", async () => {
    const repo = new InMemoryConflictRepo();
    const store = versionStore({ a: 1, b: 1 });
    const svc = new ConflictService({ repo, currentVersion: store.currentVersion });
    const alt = await svc.createAuto(
      { koA: "a", koB: "b", type: "truth", description: "Altbestand ohne Versionsbindung" },
      { trigger: "validation", method: "model" },
    );
    const aktuell = await svc.createAuto(
      {
        koA: "a",
        koB: "b",
        type: "truth",
        description: "aktuell gebunden",
        koAVersion: 1,
        koBVersion: 1,
      },
      { trigger: "validation", method: "model" },
    );

    expect(await svc.unresolved()).toHaveLength(2);
    expect((await svc.get(alt.id))?.status).toBe("offen");
    expect((await svc.get(aktuell.id))?.status).toBe("offen");
    // Kein Über-Filtern und kein fälschlicher GC.
    await flushGc();
    expect(await svc.unresolved()).toHaveLength(2);
  });
});

describe("aistate-fix5 · fail-closed Read-Pfad + Lese-GC (Overlap)", () => {
  it("stale gebundener OFFENER Eintrag: unsichtbar über unresolved() UND get(); der GC schließt ihn idempotent (superseded), ein zweiter Read findet ihn geschlossen", async () => {
    const repo = new InMemoryOverlapRepo();
    const store = versionStore({ a: 1, b: 1 });
    const audited: string[] = [];
    const svc = new OverlapService({
      repo,
      audit: captureAudit(audited),
      currentVersion: store.currentVersion,
    });
    const stale = await svc.createAuto(
      {
        koA: "a",
        koB: "b",
        relation: "identisch",
        aspects: [],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
        koAVersion: 1,
        koBVersion: 1,
      },
      { trigger: "validation", method: "deterministic", lexicalScore: 1 },
    );
    store.versions.set("a", 3);

    expect(await svc.unresolved()).toHaveLength(0);
    expect(await svc.badgeCount()).toBe(0);
    expect(await svc.get(stale.id)).toBeUndefined();

    await flushGc();
    const closed = await repo.findById(stale.id);
    expect(closed?.status).toBe("geschlossen");
    expect(closed?.resolution?.reason).toBe("superseded");
    expect(closed?.resolution?.by).toBeNull();

    expect(await svc.unresolved()).toHaveLength(0);
    expect((await svc.get(stale.id))?.status).toBe("geschlossen");
    expect(audited.filter((a) => a === "overlap.superseded")).toHaveLength(1);
    await flushGc();
    expect(audited.filter((a) => a === "overlap.superseded")).toHaveLength(1);
  });
});

describe("aistate-fix5 · die ECHTEN Detail-Routen sind fail-closed (bens ROT 2)", () => {
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

  it("GET /api/conflicts/:id UND /api/duplicates/:id liefern für stale gebundene OFFENE Befunde 404; der GC schließt sie; Altbestand/aktuell gebunden bleiben 200", async () => {
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

    // Karteileichen aus der Vor-fix4-Welt bzw. dem (bewusst nicht serialisierten) Schreib-Race:
    // offen, aber an eine sicher veraltete Version gebunden (direkt per createAuto persistiert).
    const staleConflict = await services.conflicts.createAuto(
      {
        koA: a.id,
        koB: b.id,
        type: "truth",
        description: "stale Karteileiche",
        koAVersion: a.version,
        koBVersion: (b.version ?? 1) + 7,
      },
      { trigger: "validation", method: "model" },
    );
    const staleOverlap = await services.overlaps.createAuto(
      {
        koA: a.id,
        koB: b.id,
        relation: "identisch",
        aspects: [],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
        koAVersion: (a.version ?? 1) + 3,
        koBVersion: b.version,
      },
      { trigger: "validation", method: "deterministic", lexicalScore: 1 },
    );

    // bens ROT 2 geschlossen: BEIDE Detail-Routen liefern ein ehrliches 404 — nie den offenen Befund.
    const conflict404 = await app.inject({
      method: "GET",
      url: `/api/conflicts/${staleConflict.id}`,
      headers,
    });
    expect(conflict404.statusCode).toBe(404);
    const duplicate404 = await app.inject({
      method: "GET",
      url: `/api/duplicates/${staleOverlap.id}`,
      headers,
    });
    expect(duplicate404.statusCode).toBe(404);

    // Lese-GC über den ECHTEN Routen-Pfad: beide Karteileichen sind systemisch geschlossen …
    await flushGc();
    const closedConflict = await services.conflicts.get(staleConflict.id);
    expect(closedConflict?.status).toBe("geloest");
    expect(closedConflict?.resolutionReason).toBe("superseded");
    const closedOverlap = await services.overlaps.get(staleOverlap.id);
    expect(closedOverlap?.status).toBe("geschlossen");
    expect(closedOverlap?.resolution?.reason).toBe("superseded");
    // … und der zweite Routen-Read liefert nur noch den GESCHLOSSENEN Grabstein (nie offen).
    const conflictAgain = await app.inject({
      method: "GET",
      url: `/api/conflicts/${staleConflict.id}`,
      headers,
    });
    expect(conflictAgain.statusCode).toBe(200);
    expect((conflictAgain.json() as { status: string }).status).toBe("geloest");

    // Gegenprobe 1: Altbestand ohne Versionsfelder bleibt über die Detail-Route sichtbar (200, offen).
    const alt = await services.conflicts.createAuto(
      { koA: a.id, koB: b.id, type: "truth", description: "Altbestand ohne Versionsbindung" },
      { trigger: "validation", method: "model" },
    );
    const altRes = await app.inject({ method: "GET", url: `/api/conflicts/${alt.id}`, headers });
    expect(altRes.statusCode).toBe(200);
    expect((altRes.json() as { status: string }).status).toBe("offen");

    // Gegenprobe 2: ein aktuell gebundener Eintrag bleibt sichtbar (kein Über-Filtern, kein GC).
    const aktuell = await services.overlaps.createAuto(
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
    const aktuellRes = await app.inject({
      method: "GET",
      url: `/api/duplicates/${aktuell.id}`,
      headers,
    });
    expect(aktuellRes.statusCode).toBe(200);
    await flushGc();
    expect((await services.overlaps.unresolved()).map((e) => e.id)).toContain(aktuell.id);
  });
});
