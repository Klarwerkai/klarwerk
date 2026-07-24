// AUFTRAG-aistate-fix6 (bens fix5-Recheck §2.2/§4, 24.07.) — der Lese-GC ist jetzt NEBENLÄUFIGKEITS-
// SICHER über einen STATUS-CAS (repo.supersedeIfOpen), nicht mehr Check-then-Act mit unbedingtem
// Vollobjekt-Update. Diese Tests pinnen das ECHTE Race (nicht nur das In-Memory-Synchron-Artefakt):
//  1. Barrier-Paralleltest (Konflikt UND Overlap): zwei GC-Läufe erreichen BEIDE den offenen Zustand,
//     bevor einer schreibt ⇒ genau EIN Statuswechsel und genau EIN Audit (Gewinner), der andere no-op.
//  2. Race gegen eine menschliche Auflösung: der Mensch löst zwischen GC-Lesung und GC-CAS auf ⇒ der
//     GC schließt/überschreibt NICHT; die menschliche Entscheidung bleibt erhalten, kein superseded-Audit.
//  3. Audit-Fehler nach gewinnendem CAS ⇒ der Fehler ist SICHTBAR (onError), nicht still; Status bleibt
//     konsistent (geschlossen), aber der fehlende Audit bleibt nicht dauerhaft unbemerkt.
import { describe, expect, it } from "vitest";
import type { AuditService } from "../../services/audit";
import {
  ConflictService,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
} from "../../services/conflicts";

// Ein Timer-Durchlauf (Makrotask) lässt alle zuvor angestoßenen GC-Ketten abschließen. Zweifach, damit
// auch die per Barrier freigegebenen Fortsetzungen sicher durchlaufen.
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

// Latch: gibt erst frei, wenn n Aufrufer angekommen sind — so parken beide GC-Läufe garantiert am
// offenen Zustand, bevor einer den CAS ausführt.
function makeBarrier(n: number) {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  return {
    async wait() {
      arrived += 1;
      if (arrived >= n) {
        release();
      }
      await gate;
    },
  };
}

describe("aistate-fix6 · Lese-GC nebenläufigkeitssicher — Konflikt", () => {
  it("Barrier: zwei GC-Läufe erreichen BEIDE den offenen Zustand ⇒ genau EIN Statuswechsel, genau EIN Audit", async () => {
    const versions = new Map([
      ["a", 1],
      ["b", 1],
    ]);
    const barrier = makeBarrier(2);
    const observedBeforeCas: (string | undefined)[] = [];
    // Repo-Fake mit ECHTEM Barrier-Fenster: beide Läufe lesen den Status ('offen'), parken, und erst
    // NACH der Freigabe läuft der (atomare) CAS-Tail — genau das Produktions-Race mit zwei parallel
    // ausstehenden Queries, die beide den offenen Stand sahen.
    class BarrierConflictRepo extends InMemoryConflictRepo {
      override async supersedeIfOpen(
        id: string,
        patch: Parameters<InMemoryConflictRepo["supersedeIfOpen"]>[1],
      ) {
        observedBeforeCas.push((await this.findById(id))?.status);
        await barrier.wait();
        return super.supersedeIfOpen(id, patch);
      }
    }
    const repo = new BarrierConflictRepo();
    const audited: string[] = [];
    const svc = new ConflictService({
      repo,
      audit: captureAudit(audited),
      currentVersion: async (koId) => versions.get(koId),
    });
    const stale = await svc.createAuto(
      {
        koA: "a",
        koB: "b",
        type: "truth",
        description: "Karteileiche",
        koAVersion: 1,
        koBVersion: 1,
      },
      { trigger: "validation", method: "model" },
    );
    versions.set("b", 2); // ab jetzt SICHER stale gebunden

    // Zwei stale Reads ⇒ zwei GC-Läufe (zwei Timer, zwei supersedeIfOpen am Barrier).
    expect(await svc.unresolved()).toHaveLength(0);
    expect(await svc.unresolved()).toHaveLength(0);
    await flushGc();
    await flushGc();

    // Beide sahen den OFFENEN Zustand, bevor einer schrieb …
    expect(observedBeforeCas).toEqual(["offen", "offen"]);
    // … aber es gibt genau EINEN Statuswechsel und genau EIN Audit (nur der CAS-Gewinner auditiert).
    const closed = await repo.findById(stale.id);
    expect(closed?.status).toBe("geloest");
    expect(closed?.resolutionReason).toBe("superseded");
    expect(closed?.decidedBy).toBeNull();
    expect(audited.filter((a) => a === "conflict.superseded")).toHaveLength(1);
  });

  it("Race gegen menschliche Auflösung: Mensch löst zwischen GC-Lesung und CAS ⇒ GC überschreibt NICHT, kein superseded-Audit", async () => {
    const versions = new Map([
      ["a", 1],
      ["b", 1],
    ]);
    const audited: string[] = [];
    let humanActed = false;
    // Der Mensch löst GENAU im CAS-Fenster (nach der GC-Lesung, vor dem GC-CAS) auf.
    class RaceConflictRepo extends InMemoryConflictRepo {
      human?: () => Promise<void>;
      override async supersedeIfOpen(
        id: string,
        patch: Parameters<InMemoryConflictRepo["supersedeIfOpen"]>[1],
      ) {
        if (this.human && !humanActed) {
          humanActed = true;
          await this.human();
        }
        return super.supersedeIfOpen(id, patch);
      }
    }
    const repo = new RaceConflictRepo();
    const svc = new ConflictService({
      repo,
      audit: captureAudit(audited),
      currentVersion: async (koId) => versions.get(koId),
    });
    const stale = await svc.createAuto(
      {
        koA: "a",
        koB: "b",
        type: "truth",
        description: "Karteileiche",
        koAVersion: 1,
        koBVersion: 1,
      },
      { trigger: "validation", method: "model" },
    );
    versions.set("b", 2);
    repo.human = async () => {
      await svc.dismiss(stale.id, "mensch", "kein Widerspruch");
    };

    expect(await svc.unresolved()).toHaveLength(0);
    await flushGc();
    await flushGc();

    // Die menschliche Entscheidung bleibt UNVERSEHRT — der GC hat sie nicht mit superseded überschrieben.
    const after = await repo.findById(stale.id);
    expect(after?.status).toBe("geloest");
    expect(after?.decidedBy).toBe("mensch");
    expect(after?.resolutionReason).toBe("dismissed");
    expect(audited).toContain("conflict.dismissed");
    expect(audited).not.toContain("conflict.superseded");
  });

  it("Audit-Fehler nach gewinnendem CAS: Fehler ist SICHTBAR (onError), Status bleibt konsistent geschlossen", async () => {
    const versions = new Map([
      ["a", 1],
      ["b", 1],
    ]);
    // Nur der superseded-Audit (nach gewinnendem CAS) fällt aus — die Anlage (auto-created) gelingt.
    const failingAudit = {
      record: async (e: { action: string }) => {
        if (e.action.endsWith("superseded")) {
          throw new Error("audit-ledger nicht erreichbar");
        }
      },
    } as unknown as AuditService;
    const errors: { context: string; error: unknown }[] = [];
    const repo = new InMemoryConflictRepo();
    const svc = new ConflictService({
      repo,
      audit: failingAudit,
      currentVersion: async (koId) => versions.get(koId),
      onError: (context, error) => errors.push({ context, error }),
    });
    const stale = await svc.createAuto(
      {
        koA: "a",
        koB: "b",
        type: "truth",
        description: "Karteileiche",
        koAVersion: 1,
        koBVersion: 1,
      },
      { trigger: "validation", method: "model" },
    );
    versions.set("b", 2);

    expect(await svc.get(stale.id)).toBeUndefined();
    await flushGc();
    await flushGc();

    // Der CAS-Abschluss ist konsistent (der Datensatz ist geschlossen) …
    const closed = await repo.findById(stale.id);
    expect(closed?.status).toBe("geloest");
    expect(closed?.resolutionReason).toBe("superseded");
    // … aber der Audit-Ausfall wird NICHT still geschluckt: er erreicht den belastbaren Fehlerkanal.
    expect(errors).toHaveLength(1);
    expect(errors[0]?.context).toContain("superseded audit");
    expect((errors[0]?.error as Error).message).toContain("audit-ledger");
  });
});

describe("aistate-fix6 · Lese-GC nebenläufigkeitssicher — Overlap", () => {
  it("Barrier: zwei GC-Läufe erreichen BEIDE den offenen Zustand ⇒ genau EIN Statuswechsel, genau EIN Audit", async () => {
    const versions = new Map([
      ["a", 1],
      ["b", 1],
    ]);
    const barrier = makeBarrier(2);
    const observedBeforeCas: (string | undefined)[] = [];
    class BarrierOverlapRepo extends InMemoryOverlapRepo {
      override async supersedeIfOpen(
        id: string,
        patch: Parameters<InMemoryOverlapRepo["supersedeIfOpen"]>[1],
      ) {
        observedBeforeCas.push((await this.findById(id))?.status);
        await barrier.wait();
        return super.supersedeIfOpen(id, patch);
      }
    }
    const repo = new BarrierOverlapRepo();
    const audited: string[] = [];
    const svc = new OverlapService({
      repo,
      audit: captureAudit(audited),
      currentVersion: async (koId) => versions.get(koId),
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
    versions.set("a", 3);

    expect(await svc.unresolved()).toHaveLength(0);
    expect(await svc.unresolved()).toHaveLength(0);
    await flushGc();
    await flushGc();

    expect(observedBeforeCas).toEqual(["offen", "offen"]);
    const closed = await repo.findById(stale.id);
    expect(closed?.status).toBe("geschlossen");
    expect(closed?.resolution?.reason).toBe("superseded");
    expect(closed?.resolution?.by).toBeNull();
    expect(audited.filter((a) => a === "overlap.superseded")).toHaveLength(1);
  });

  it("Race gegen menschliche Auflösung: Mensch schließt zwischen GC-Lesung und CAS ⇒ GC überschreibt NICHT, kein superseded-Audit", async () => {
    const versions = new Map([
      ["a", 1],
      ["b", 1],
    ]);
    const audited: string[] = [];
    let humanActed = false;
    class RaceOverlapRepo extends InMemoryOverlapRepo {
      human?: () => Promise<void>;
      override async supersedeIfOpen(
        id: string,
        patch: Parameters<InMemoryOverlapRepo["supersedeIfOpen"]>[1],
      ) {
        if (this.human && !humanActed) {
          humanActed = true;
          await this.human();
        }
        return super.supersedeIfOpen(id, patch);
      }
    }
    const repo = new RaceOverlapRepo();
    const svc = new OverlapService({
      repo,
      audit: captureAudit(audited),
      currentVersion: async (koId) => versions.get(koId),
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
    versions.set("a", 3);
    repo.human = async () => {
      await svc.dismiss(stale.id, "mensch", "kein Duplikat");
    };

    expect(await svc.unresolved()).toHaveLength(0);
    await flushGc();
    await flushGc();

    const after = await repo.findById(stale.id);
    expect(after?.status).toBe("geschlossen");
    expect(after?.resolution?.reason).toBe("dismissed");
    expect(after?.resolution?.by).toBe("mensch");
    expect(audited).toContain("overlap.dismissed");
    expect(audited).not.toContain("overlap.superseded");
  });

  it("Audit-Fehler nach gewinnendem CAS: Fehler ist SICHTBAR (onError), Status bleibt konsistent geschlossen", async () => {
    const versions = new Map([
      ["a", 1],
      ["b", 1],
    ]);
    // Nur der superseded-Audit (nach gewinnendem CAS) fällt aus — die Anlage (auto-created) gelingt.
    const failingAudit = {
      record: async (e: { action: string }) => {
        if (e.action.endsWith("superseded")) {
          throw new Error("audit-ledger nicht erreichbar");
        }
      },
    } as unknown as AuditService;
    const errors: { context: string; error: unknown }[] = [];
    const repo = new InMemoryOverlapRepo();
    const svc = new OverlapService({
      repo,
      audit: failingAudit,
      currentVersion: async (koId) => versions.get(koId),
      onError: (context, error) => errors.push({ context, error }),
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
    versions.set("a", 3);

    expect(await svc.get(stale.id)).toBeUndefined();
    await flushGc();
    await flushGc();

    const closed = await repo.findById(stale.id);
    expect(closed?.status).toBe("geschlossen");
    expect(closed?.resolution?.reason).toBe("superseded");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.context).toContain("superseded audit");
  });
});
