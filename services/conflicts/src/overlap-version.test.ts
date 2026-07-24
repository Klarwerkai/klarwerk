// D-AISTATE PAKET 4 (bens V5, 23.07.) — Befunde versionsgebunden, Stale-Schreibschutz, versionsbewusste
// Paar-Dedupe. Belegt am OverlapService (Muster gilt symmetrisch für ConflictService):
//  - jeder auto-Befund trägt BEIDE geprüften KO-Versionen (additiv),
//  - vor dem Persistieren prüft isCurrent beide Versionen — eine revidierte Seite ⇒ KEIN aktiver Befund,
//  - ein stale-Befund (alte Versionskombination) blockiert einen neuen Lauf NICHT; die aktuelle blockt.
import { describe, expect, it } from "vitest";
import type { ConflictVerdict, DetectSubject } from "./detect";
import type { OverlapVerdict } from "./duplicate-detect";
import { InMemoryOverlapRepo } from "./overlap-repo";
import { OverlapService } from "./overlap-service";
import { InMemoryConflictRepo } from "./repo";
import { ConflictService } from "./service";

// Zwei wortgleiche Kerntexte → deterministischer Overlap (kein Judge nötig).
function sub(refId: string, version: number): DetectSubject {
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
const noJudge = async (): Promise<OverlapVerdict | null> => null;

describe("D-AISTATE V5: OverlapService — Versionen an Befunden + Stale-Schreibschutz", () => {
  it("aktueller Lauf: Befund trägt BEIDE geprüften Versionen (additiv)", async () => {
    const repo = new InMemoryOverlapRepo();
    const svc = new OverlapService({ repo });
    const created = await svc.detectForSubject(sub("a", 3), [sub("b", 5)], noJudge, {
      isCurrent: async () => true,
    });
    expect(created).toHaveLength(1);
    expect(created[0]?.detector?.method).toBe("deterministic");
    expect(created[0]?.koAVersion).toBe(3);
    expect(created[0]?.koBVersion).toBe(5);
  });

  it("Stale-Schreibschutz: eine Seite revidiert (isCurrent=false) ⇒ KEIN aktiver Befund", async () => {
    const repo = new InMemoryOverlapRepo();
    const svc = new OverlapService({ repo });
    const created = await svc.detectForSubject(sub("a", 1), [sub("b", 1)], noJudge, {
      isCurrent: async (id) => id !== "a", // a wurde inzwischen revidiert → nicht mehr aktuell
    });
    expect(created).toHaveLength(0);
    expect(await repo.all()).toHaveLength(0);
  });

  it("versionsbewusste Dedupe: stale-Befund (alte Kombi) blockt neuen Lauf NICHT", async () => {
    const repo = new InMemoryOverlapRepo();
    const svc = new OverlapService({ repo });
    // Erster Lauf: Befund zur Kombination a@1-b@1.
    await svc.detectForSubject(sub("a", 1), [sub("b", 1)], noJudge, {
      isCurrent: async () => true,
    });
    // Neue Fassung a@2-b@2 — der alte Befund ist stale und blockt NICHT.
    const again = await svc.detectForSubject(sub("a", 2), [sub("b", 2)], noJudge, {
      isCurrent: async () => true,
    });
    expect(again).toHaveLength(1);
    expect(again[0]?.koAVersion).toBe(2);
    expect(again[0]?.koBVersion).toBe(2);
    // Beide Fassungen liegen im Repo (Historie erhalten).
    expect(await repo.all()).toHaveLength(2);
  });

  it("versionsbewusste Dedupe: die AKTUELLE Versionskombination blockt (kein Doppel-Befund)", async () => {
    const repo = new InMemoryOverlapRepo();
    const svc = new OverlapService({ repo });
    await svc.detectForSubject(sub("a", 2), [sub("b", 2)], noJudge, {
      isCurrent: async () => true,
    });
    const again = await svc.detectForSubject(sub("a", 2), [sub("b", 2)], noJudge, {
      isCurrent: async () => true,
    });
    expect(again).toHaveLength(0);
    expect(await repo.all()).toHaveLength(1);
  });

  it("atomare Aktivierung (aistate-fix4): Revision WÄHREND der Versionssicherung ⇒ GAR KEIN Datensatz committed (kein Insert-dann-Kompensieren)", async () => {
    const repo = new InMemoryOverlapRepo();
    const svc = new OverlapService({ repo });
    // isCurrent liefert für die erste Seite true und für die zweite false — die Revision landet
    // mitten in der Versionssicherung. Der atomare Insert (insertIfVersionsCurrent) darf dann
    // NICHTS committen: kein offener UND kein kompensierend geschlossener Datensatz.
    let calls = 0;
    const flipping = async (): Promise<boolean> => {
      calls += 1;
      return calls <= 1;
    };
    const created = await svc.detectForSubject(sub("a", 1), [sub("b", 1)], noJudge, {
      isCurrent: flipping,
    });
    expect(created).toHaveLength(0);
    expect(await svc.unresolved()).toHaveLength(0);
    // Kernbeleg der fix4-Auflage: das Repo ist LEER — der stale Lauf hat nie einen Datensatz
    // (auch keinen sofort geschlossenen) hinterlassen.
    expect(await repo.all()).toHaveLength(0);
  });

  it("onKoRevised (aistate-fix3): Revisions-Sweep schließt offene Befunde älterer Versionen als superseded", async () => {
    const repo = new InMemoryOverlapRepo();
    const svc = new OverlapService({ repo });
    await svc.detectForSubject(sub("a", 1), [sub("b", 1)], noJudge, {
      isCurrent: async () => true,
    });
    expect(await svc.unresolved()).toHaveLength(1);
    const closed = await svc.onKoRevised("a", 2);
    expect(closed).toBe(1);
    expect(await svc.unresolved()).toHaveLength(0);
    expect(await svc.badgeCount()).toBe(0);
    // Idempotent: ein zweiter Sweep schließt nichts erneut.
    expect(await svc.onKoRevised("a", 2)).toBe(0);
  });

  it("Altbestand: ein versionsloser offener Befund blockt konservativ wie bisher", async () => {
    const repo = new InMemoryOverlapRepo();
    const svc = new OverlapService({ repo });
    // Versionsloser Alt-Befund (createAuto ohne koAVersion/koBVersion).
    await svc.createAuto(
      {
        koA: "a",
        koB: "b",
        relation: "identisch",
        aspects: [],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "validation", method: "deterministic", lexicalScore: 1 },
    );
    const again = await svc.detectForSubject(sub("a", 2), [sub("b", 2)], noJudge, {
      isCurrent: async () => true,
    });
    expect(again).toHaveLength(0); // konservativ geblockt (Altbestand ohne Versionsfelder)
    expect(await repo.all()).toHaveLength(1);
  });
});

// aistate-fix3 (bens V5): dieselben CAS-/Sweep-Garantien auf der KONFLIKT-Seite (nicht nur Overlap).
describe("D-AISTATE V5 (fix3): ConflictService — CAS-Fenster + Revisions-Sweep", () => {
  const conflictSub = (refId: string, statement: string, version: number): DetectSubject => ({
    refId,
    title: `Ventil ${refId}`,
    statement,
    conditions: [],
    measures: [],
    category: "K",
    tags: [],
    asset: null,
    version,
  });
  const widerspruch = async (): Promise<ConflictVerdict> => ({
    relation: "widerspruch",
    older: null,
    confidence: 0.9,
    begruendung: "Farbwiderspruch",
    zitat_a: "Das Ventil ist blau",
    zitat_b: "Das Ventil ist rot",
  });

  it("atomare Aktivierung (aistate-fix4): Revision während der Versionssicherung ⇒ GAR KEIN Konflikt-Datensatz committed", async () => {
    const repo = new InMemoryConflictRepo();
    const svc = new ConflictService({ repo });
    let calls = 0;
    const flipping = async (): Promise<boolean> => {
      calls += 1;
      return calls <= 1;
    };
    const created = await svc.detectForSubject(
      conflictSub("a", "Das Ventil ist blau.", 1),
      [conflictSub("b", "Das Ventil ist rot.", 1)],
      widerspruch,
      { isCurrent: flipping },
    );
    expect(created).toHaveLength(0);
    expect(await svc.unresolved()).toHaveLength(0);
    // Kernbeleg der fix4-Auflage: kein offener und kein kompensierend geschlossener Datensatz.
    expect(await repo.all()).toHaveLength(0);
  });

  it("onKoRevised: Sweep schließt offene versionsgebundene Konflikte älterer Fassungen", async () => {
    const repo = new InMemoryConflictRepo();
    const svc = new ConflictService({ repo });
    await svc.detectForSubject(
      conflictSub("a", "Das Ventil ist blau.", 1),
      [conflictSub("b", "Das Ventil ist rot.", 1)],
      widerspruch,
      { isCurrent: async () => true },
    );
    expect(await svc.unresolved()).toHaveLength(1);
    expect(await svc.onKoRevised("b", 2)).toBe(1);
    expect(await svc.unresolved()).toHaveLength(0);
    expect(await svc.onKoRevised("b", 2)).toBe(0); // idempotent
  });
});
