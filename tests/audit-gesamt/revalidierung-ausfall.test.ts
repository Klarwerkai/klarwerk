// Aufnahme gesamt-auditprotokoll · §12.3 „Re-Validierung" (Runde 2) — KEINE NEU-VALIDIERUNG OHNE BELEG.
//
// Bens Befund aus Runde 1: `confirmStillValid` erhöhte die Fassung und löschte den „Stimmt das
// noch?"-Merker, BEVOR `ko.revalidated` angehängt wurde. Fiel genau dieses Anhängen aus, blieb die
// Neu-Validierung wirksam (Fassung 2, kein Merker) — ohne ihren Beleg.
//
// Seit Runde 2 läuft `ko.revalidated` im Audit-Schritt der Revision (`KoService.revise`,
// `zusatzBeleg`). Scheitert er, rollt die Revision zurück und der Merker bleibt. Hier mit echten
// `KoService`-, `LifecycleService`- und `AuditService`-Instanzen auf Speicherablagen; dieselbe
// Messung gegen echtes PostgreSQL mit echter Transaktion steht in
// `revalidierung-atomar.integration.test.ts`.
import { describe, expect, it } from "vitest";
import {
  type AuditEntry,
  type AuditRepo,
  AuditService,
  InMemoryAuditRepo,
} from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  InMemoryLifecycleRepo,
  type LifecycleRepo,
  LifecycleService,
} from "../../services/lifecycle";

function auditMitAusfall(inner: AuditRepo, scharf: { an: boolean }): AuditRepo {
  return {
    append: async (entry: AuditEntry, tx) => {
      if (scharf.an && entry.action === "ko.revalidated") {
        throw new Error("AUDIT_UNAVAILABLE");
      }
      return inner.append(entry, tx);
    },
    appendOnce: (entry, tx) => inner.appendOnce(entry, tx),
    all: () => inner.all(),
    last: (tx) => inner.last(tx),
  };
}

/** Ein Merkerspeicher, dessen `clearPending` gezielt ausfallen kann — sonst die echte Ablage. */
function merkerMitAusfall(
  inner: InMemoryLifecycleRepo,
  scharf: { an: boolean; nachher: boolean },
): LifecycleRepo {
  return new Proxy(inner, {
    get(ziel, name, empfaenger) {
      if (name === "clearPending") {
        return async (koId: string) => {
          if (scharf.an) {
            throw new Error("CLEAR_UNAVAILABLE");
          }
          const entfernt = await ziel.clearPending(koId);
          // Lauf 2 (Bens Gegenprobe): das Löschen ist ausgeführt, danach kommt ein Fehler.
          if (scharf.nachher) {
            throw new Error("CLEAR_REPLY_LOST");
          }
          return entfernt;
        };
      }
      const wert = Reflect.get(ziel, name, empfaenger);
      return typeof wert === "function" ? wert.bind(ziel) : wert;
    },
  });
}

async function welt() {
  const scharf = { an: false };
  const merkerAus = { an: false, nachher: false };
  const audit = new AuditService({ repo: auditMitAusfall(new InMemoryAuditRepo(), scharf) });
  const koService = new KoService({ repo: new InMemoryKoRepo(), audit });
  const repo = merkerMitAusfall(new InMemoryLifecycleRepo(), merkerAus);
  const lifecycle = new LifecycleService({ koService, repo });
  const ko = await koService.create({
    title: "Ventil schließen",
    statement: "Bei Überdruck schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
  });
  await lifecycle.couple("anlage-1", ko.id);
  await lifecycle.assetChanged("anlage-1");
  return { scharf, merkerAus, audit, koService, lifecycle, ko };
}

describe("Re-Validierung · Fassung, Merker und Beleg gehören zusammen", () => {
  it("Erfolgsfall: ko.revised und ko.revalidated für dieselbe Fassung, Merker weg", async () => {
    const w = await welt();
    // produkt:20261010:aenderungsfolgen-sichtbar (Nacharbeit 4): ein offener Fall wird nur mit
    // seinem angezeigten Stand abgeschlossen; der Beleg nennt ihn.
    const bestaetigt = await w.lifecycle.confirmStillValid(w.ko.id, "carla", 1);
    expect(bestaetigt.version).toBe(2);
    expect(await w.lifecycle.pendingRevalidation()).not.toContain(w.ko.id);
    const belege = await w.audit.list({ target: w.ko.id });
    const reval = belege.find((e) => e.action === "ko.revalidated");
    const revised = belege.find((e) => e.action === "ko.revised");
    expect(reval?.actor).toBe("carla");
    expect(reval?.payload).toEqual({ pendingCleared: true, geprueftStand: 1, version: 2 });
    expect(revised?.payload).toEqual({ version: 2 });
    // Direkt hintereinander — derselbe Audit-Schritt.
    expect((reval?.seq ?? 0) - (revised?.seq ?? 0)).toBe(1);
    expect((await w.audit.verifyReport()).ok).toBe(true);
  });

  it("Ausfall NUR beim ko.revalidated-Beleg: Fehler, Fassung bleibt 1, Merker bleibt, kein ko.revalidated", async () => {
    const w = await welt();
    w.scharf.an = true;
    await expect(w.lifecycle.confirmStillValid(w.ko.id, "carla", 1)).rejects.toThrow(
      "AUDIT_UNAVAILABLE",
    );
    expect((await w.koService.get(w.ko.id))?.version).toBe(1);
    expect(await w.lifecycle.pendingRevalidation()).toContain(w.ko.id);
    expect(await w.audit.list({ action: "ko.revalidated" })).toEqual([]);
    expect((await w.audit.verifyReport()).ok).toBe(true);
    // Runde 3 (Bens Befund): ohne `withTx` bleibt der zuvor angehängte `ko.revised`-Beleg stehen —
    // die Kette ist append-only, er wird nicht angefasst. Aber er bleibt nicht UNKOMMENTIERT: direkt
    // danach steht `ko.change-rolled-back` mit der zurückgenommenen Fassung und seiner Sequenz.
    const belege = await w.audit.list({ target: w.ko.id });
    const revised = belege.filter((e) => e.action === "ko.revised");
    expect(revised.map((e) => e.payload)).toEqual([{ version: 2 }]);
    const ruecknahme = belege.filter((e) => e.action === "ko.change-rolled-back");
    expect(ruecknahme.map((e) => e.payload)).toEqual([
      { version: 2, restoredVersion: 1, rolledBackSeqs: [revised[0]?.seq] },
    ]);
    expect((ruecknahme[0]?.seq ?? 0) > (revised[0]?.seq ?? 0)).toBe(true);

    // Nach dem Ausfall gelingt die Bestätigung regulär — und erst dann ist der Merker weg.
    w.scharf.an = false;
    const bestaetigt = await w.lifecycle.confirmStillValid(w.ko.id, "carla", 1);
    expect(bestaetigt.version).toBe(2);
    expect(await w.lifecycle.pendingRevalidation()).not.toContain(w.ko.id);
    expect((await w.audit.list({ action: "ko.revalidated" })).map((e) => e.payload)).toEqual([
      { pendingCleared: true, geprueftStand: 1, version: 2 },
    ]);
  });

  it("Runde 3 · Ausfall NUR beim Löschen des Merkers: nichts geschieht, und nichts wird behauptet", async () => {
    const w = await welt();
    w.merkerAus.an = true;
    await expect(w.lifecycle.confirmStillValid(w.ko.id, "carla", 1)).rejects.toThrow(
      "CLEAR_UNAVAILABLE",
    );
    expect((await w.koService.get(w.ko.id))?.version).toBe(1);
    expect(await w.lifecycle.pendingRevalidation()).toContain(w.ko.id);
    // Kein Beleg mit `pendingCleared: true` — der Merker wurde ja nicht gelöscht.
    expect(await w.audit.list({ action: "ko.revalidated" })).toEqual([]);
    expect(await w.audit.list({ action: "ko.revised" })).toEqual([]);
    expect((await w.audit.verifyReport()).ok).toBe(true);
  });

  it("Lauf 2 · Fehler NACH ausgeführtem Löschen: Merker wieder gesetzt, keine Fassung, kein Beleg", async () => {
    // Bens Gegenprobe aus Lauf 1, Runde 3: das Löschen ist geschehen, dann kommt ein Fehler. Früher
    // blieb der Merker weg — ohne Fassung und ohne Beleg.
    const w = await welt();
    const vorher = (await w.audit.list({ target: w.ko.id })).map((e) => e.action);
    w.merkerAus.nachher = true;
    await expect(w.lifecycle.confirmStillValid(w.ko.id, "carla", 1)).rejects.toThrow(
      "CLEAR_REPLY_LOST",
    );
    expect((await w.koService.get(w.ko.id))?.version).toBe(1);
    expect(await w.lifecycle.pendingRevalidation()).toContain(w.ko.id);
    // Der Fehler kam vor dem ersten Beleg dieses Schritts: nichts angehängt, also auch nichts
    // zurückzunehmen.
    expect((await w.audit.list({ target: w.ko.id })).map((e) => e.action)).toEqual(vorher);
    expect((await w.audit.verifyReport()).ok).toBe(true);
  });

  it("Lauf 2 · ohne vorherigen Merker setzt ein Ausfall keinen neuen", async () => {
    const w = await welt();
    await w.lifecycle.confirmStillValid(w.ko.id, "carla", 1);
    w.scharf.an = true;
    await expect(w.lifecycle.confirmStillValid(w.ko.id, "carla")).rejects.toThrow(
      "AUDIT_UNAVAILABLE",
    );
    expect(await w.lifecycle.pendingRevalidation()).not.toContain(w.ko.id);
  });

  it("Runde 3 · ohne offenen Merker sagt der Beleg pendingCleared: false", async () => {
    const w = await welt();
    await w.lifecycle.confirmStillValid(w.ko.id, "carla", 1);
    // Ohne offenen Fall bleibt die reine Gültigkeitsbestätigung ohne Stand möglich.
    const zweite = await w.lifecycle.confirmStillValid(w.ko.id, "carla");
    expect(zweite.version).toBe(3);
    expect((await w.audit.list({ action: "ko.revalidated" })).map((e) => e.payload)).toEqual([
      { pendingCleared: true, geprueftStand: 1, version: 2 },
      { pendingCleared: false, version: 3 },
    ]);
  });
});
