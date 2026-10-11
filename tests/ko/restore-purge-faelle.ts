// ==================================================================================================
// AUFNAHME 20260922 · gesamt-papierkorb — WIEDERHERSTELLEN GEGEN ENDLÖSCHUNG, BEIDE REIHENFOLGEN.
// ==================================================================================================
//
// Bens Befund (Nacharbeit 2): „Beim Wissensobjekt bleiben Prüfung des Papierkorbstatus und
// Endlöschung getrennt. Ein angelaufener Purge kann ein inzwischen erfolgreich wiederhergestelltes
// Objekt löschen." Verlangt: eine gemeinsame atomare Zustandsentscheidung, Audit und Aufräumen
// folgen ihr, beide kontrollierten Reihenfolgen belegt, sofortige Demo-Endlöschung erhalten.
//
// DIE REIHENFOLGE IST GESTEUERT, NICHT ERHOFFT: ein Tor vor `repo.delete` bzw. `repo.update` hält
// den einen Vorgang genau NACH seiner Vorablesung an, der andere läuft vollständig durch, dann
// öffnet das Tor. Dieselben Fälle laufen gegen den Speicher (`restore-purge-reihenfolge.test.ts`)
// und gegen echtes PostgreSQL (`restore-purge-reihenfolge-pg.integration.test.ts`).
import { expect, it } from "vitest";
import type { AuditEntry } from "../../services/audit";
import type { KoRepo, KoService } from "../../services/knowledge-object";

export interface Halt {
  vorDelete?: () => Promise<void>;
  vorUpdate?: () => Promise<void>;
}

/** Hüllt eine Ablage; ein gesetzter Halt greift genau EINMAL vor dem nächsten delete/update. */
export function gesteuert<R extends KoRepo>(inner: R): { repo: R; halt: Halt } {
  const halt: Halt = {};
  const repo = new Proxy(inner, {
    get(ziel, name) {
      if (name === "delete" || name === "update") {
        return async (...args: unknown[]) => {
          const schluessel = name === "delete" ? "vorDelete" : "vorUpdate";
          const warte = halt[schluessel];
          halt[schluessel] = undefined;
          await warte?.();
          return (ziel[name] as (...a: unknown[]) => Promise<void>).apply(ziel, args);
        };
      }
      const wert = Reflect.get(ziel, name, ziel) as unknown;
      return typeof wert === "function" ? (wert as (...a: unknown[]) => unknown).bind(ziel) : wert;
    },
  });
  return { repo, halt };
}

function tor() {
  let auf!: () => void;
  let erreicht!: () => void;
  const offen = new Promise<void>((r) => {
    auf = r;
  });
  const angekommen = new Promise<void>((r) => {
    erreicht = r;
  });
  return {
    halt: async () => {
      erreicht();
      await offen;
    },
    angekommen,
    auf,
  };
}

export interface Umgebung {
  service: KoService;
  repo: KoRepo;
  halt: Halt;
  belege: () => Promise<AuditEntry[]>;
  uhr: { jetzt: number };
}

const TAG_MS = 86_400_000;

/** Der Ausgang eines Vorgangs als Wert: "erfuellt" oder der geworfene Fehler. */
function ausgang(vorgang: Promise<unknown>): Promise<unknown> {
  return vorgang.then(
    () => "erfuellt",
    (fehler: unknown) => fehler,
  );
}

export function restorePurgeFaelle(baue: () => Promise<Umgebung>, fristTage: number): void {
  async function imPapierkorb(u: Umgebung, titel: string) {
    const ko = await u.service.create({
      title: titel,
      statement: "Bei Überdruck zuerst Ventil V3 schließen.",
      type: "best_practice",
      category: "A",
      author: "erik",
    });
    await u.service.delete(ko.id, "erik");
    return ko.id;
  }
  const zahl = async (u: Umgebung, action: string, id: string) =>
    (await u.belege()).filter((e) => e.action === action && e.target === id).length;

  it("W1 · Wiederherstellen zuerst: die angelaufene Endlöschung greift ins Leere — Objekt lebt, kein ko.purged", async () => {
    const u = await baue();
    const id = await imPapierkorb(u, "Restore gewinnt");
    const t = tor();
    u.halt.vorDelete = t.halt;
    const endloeschung = ausgang(u.service.purgeTrashed(id, "admin"));
    await t.angekommen;
    const zurueck = await u.service.restore(id, "admin");
    t.auf();

    expect(await endloeschung).toMatchObject({ code: "NOT_FOUND" });
    expect(zurueck.id).toBe(id);
    const jetzt = await u.repo.findById(id);
    expect(jetzt).toBeDefined();
    expect(jetzt?.deletedAt).toBeUndefined();
    expect(jetzt?.title).toBe("Restore gewinnt");
    expect(await zahl(u, "ko.restored", id)).toBe(1);
    expect(await zahl(u, "ko.purged", id)).toBe(0);
  });

  it("W2 · Endlöschung zuerst: das angelaufene Wiederherstellen legt nichts neu an — NOT_FOUND, kein ko.restored", async () => {
    const u = await baue();
    const id = await imPapierkorb(u, "Purge gewinnt");
    const t = tor();
    u.halt.vorUpdate = t.halt;
    const zurueck = ausgang(u.service.restore(id, "admin"));
    await t.angekommen;
    await u.service.purgeTrashed(id, "admin");
    t.auf();

    expect(await zurueck).toMatchObject({ code: "NOT_FOUND" });
    expect(await u.repo.findById(id)).toBeUndefined();
    expect(await zahl(u, "ko.purged", id)).toBe(1);
    expect(await zahl(u, "ko.restored", id)).toBe(0);
  });

  it("W3 · Fristlauf gegen Wiederherstellen und erneutes Löschen: der frische Papierkorbeintrag bleibt", async () => {
    const u = await baue();
    const id = await imPapierkorb(u, "Neue Frist");
    u.uhr.jetzt += (fristTage + 1) * TAG_MS;
    u.halt.vorDelete = async () => {
      await u.service.restore(id, "admin");
      await u.service.delete(id, "erik");
    };
    const fehler: unknown[] = [];
    expect(await u.service.runTrashSweep("system", (_id, e) => fehler.push(e))).toBe(0);
    expect(fehler).toEqual([]);
    const jetzt = await u.repo.findById(id);
    expect(jetzt?.deletedAt).toBe(new Date(u.uhr.jetzt).toISOString());
    expect(await zahl(u, "ko.purged", id)).toBe(0);
    // Ohne Zwischenfall greift die Frist weiter wie zuvor.
    u.uhr.jetzt += (fristTage + 1) * TAG_MS;
    expect(await u.service.runTrashSweep("system")).toBe(1);
    expect(await u.repo.findById(id)).toBeUndefined();
  });

  it("W4 · Demodaten bleiben sofort endgültig — ohne Papierkorb, ohne Bedingung", async () => {
    const u = await baue();
    const demo = await u.service.create({
      title: "Demo",
      statement: "demo weg",
      type: "best_practice",
      category: "A",
      author: "erik",
      demoSeed: true,
    });
    await u.service.delete(demo.id, "system");
    expect(await u.repo.findById(demo.id)).toBeUndefined();
    expect(await zahl(u, "ko.purged", demo.id)).toBe(1);
  });
}
