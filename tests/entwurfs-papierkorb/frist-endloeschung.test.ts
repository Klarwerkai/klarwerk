// ==================================================================================================
// AUFNAHME 20260922 · gesamt-papierkorb — DER ENTWURFS-PAPIERKORB HÄLT DIESELBE FRIST.
// ==================================================================================================
//
// DIE FESTLEGUNG (Pedi 17.09.2026, B5, `EINGANG-20260917-PEDI-LOESCHUMFANG-B5.md`): „Papierkorb mit
// Frist von 30 Tagen, danach endgültig" — gelöschte Wissensobjekte UND Entwürfe liegen 30 Tage
// wiederherstellbar im Papierkorb und werden danach endgültig gelöscht.
//
// DER GEMESSENE STAND VOR DIESER ÄNDERUNG: Das Wissensobjekt hielt die Frist (`runTrashSweep`,
// `tests/ko/trash-e2e.test.ts`), der Entwurfs-Papierkorb (JOB 3668) leerte sich nie — die
// Seitenhilfe sagte es auch so („von selbst leert sich der Papierkorb nicht"). Dieselbe Handlung
// war damit wieder an zwei Stellen verschieden behandelt (P-ENTWURFS-PAPIERKORB).
//
// Diese Datei misst den neuen Lauf am Dienst (F1–F5) und seine Verdrahtung im Server (F6). Den
// echten PostgreSQL-Weg misst `papierkorb-pg.integration.test.ts` (P9).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gelisteteMeldung } from "../../services/app/src/log-positivliste";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import type { Draft } from "../../services/capture/src/types";
import { TRASH_RETENTION_DAYS } from "../../services/knowledge-object";

const TAG_MS = 86_400_000;
const GELOESCHT_UM = Date.parse("2026-09-12T07:00:00.000Z");

function entwurf(id: string, over: Partial<Draft> = {}): Draft {
  return {
    id,
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      confidentiality: "intern",
      origin: "studio",
    },
    originalAuthor: "anna",
    lastEditor: "anna",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    ...over,
  };
}

function aufbau(repo = new InMemoryDraftRepo()) {
  const uhr = { jetzt: GELOESCHT_UM };
  const dienst = new CaptureService({ repo, now: () => uhr.jetzt });
  return { repo, dienst, uhr };
}

describe("gesamt-papierkorb · Entwürfe im Papierkorb werden nach der Frist endgültig gelöscht", () => {
  it("F0 · Die Frist ist Pedis Festlegung vom 17.09.2026: 30 Tage, eine Quelle für beide Papierkörbe", () => {
    expect(TRASH_RETENTION_DAYS).toBe(30);
  });

  it("F1 · Einen Tag vor Fristende bleibt der Entwurf wiederherstellbar, am Fristende ist er endgültig fort", async () => {
    const { repo, dienst, uhr } = aufbau();
    await repo.insert(entwurf("d-1"));
    await dienst.deleteDraft("d-1", "anna");

    uhr.jetzt = GELOESCHT_UM + (TRASH_RETENTION_DAYS - 1) * TAG_MS;
    expect(await dienst.runDraftTrashSweep()).toBe(0);
    expect((await dienst.listTrashedDrafts()).map((d) => d.id)).toEqual(["d-1"]);

    uhr.jetzt = GELOESCHT_UM + TRASH_RETENTION_DAYS * TAG_MS;
    expect(await dienst.runDraftTrashSweep()).toBe(1);
    expect(await dienst.listTrashedDrafts()).toEqual([]);
    expect(await repo.list()).toEqual([]);
    // Endgültig heisst: auch der zweite Griff findet nichts mehr.
    await expect(dienst.restoreDraft("d-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Und ein weiterer Lauf ist folgenlos.
    expect(await dienst.runDraftTrashSweep()).toBe(0);
  });

  it("F2 · Lebende Entwürfe bleiben unberührt, egal wie alt — die Frist zählt ab dem Löschen", async () => {
    const { repo, dienst, uhr } = aufbau();
    await repo.insert(entwurf("d-lebt"));
    await repo.insert(entwurf("d-weg"));
    await dienst.deleteDraft("d-weg", "anna");

    uhr.jetzt = GELOESCHT_UM + 365 * TAG_MS;
    expect(await dienst.runDraftTrashSweep()).toBe(1);
    expect((await repo.list()).map((d) => d.id)).toEqual(["d-lebt"]);
    expect(await dienst.getDraft("d-lebt")).toBeDefined();
  });

  it("F3 · Vor Fristende zurückgeholt: der Lauf rührt den Entwurf nicht mehr an", async () => {
    const { repo, dienst, uhr } = aufbau();
    await repo.insert(entwurf("d-1"));
    await dienst.deleteDraft("d-1", "anna");
    uhr.jetzt = GELOESCHT_UM + 10 * TAG_MS;
    await dienst.restoreDraft("d-1");

    uhr.jetzt = GELOESCHT_UM + (TRASH_RETENTION_DAYS + 5) * TAG_MS;
    expect(await dienst.runDraftTrashSweep()).toBe(0);
    expect(await dienst.getDraft("d-1")).toBeDefined();
  });

  it("F4 · Zurückholen zwischen Liste und Löschung: der Entwurf lebt und wird nicht gezählt", async () => {
    // Der Lauf liest die Liste und löscht danach je Eintrag. Holt jemand den Entwurf genau
    // dazwischen zurück, muss `purge` ihn verfehlen — die Bedingung steht in der löschenden
    // Anweisung (JOB 3668 R2), nicht im Dienst.
    class ZurueckholenNachListe extends InMemoryDraftRepo {
      override async listTrashed(fuerAutor?: string) {
        const liste = await super.listTrashed(fuerAutor);
        await super.restore("d-1");
        return liste;
      }
    }
    const { repo, dienst, uhr } = aufbau(new ZurueckholenNachListe());
    await repo.insert(entwurf("d-1"));
    await dienst.deleteDraft("d-1", "anna");

    uhr.jetzt = GELOESCHT_UM + (TRASH_RETENTION_DAYS + 1) * TAG_MS;
    expect(await dienst.runDraftTrashSweep()).toBe(0);
    expect(await dienst.getDraft("d-1")).toBeDefined();
  });

  it("F4b · Liste → Zurückholen → erneut Löschen → Lauf: der frische Papierkorbeintrag behält seine neue Frist", async () => {
    // Bens Befund (Nacharbeit 2): die Frist war am ALTEN Listeneintrag geprüft, `purge(id)` prüfte
    // nur „liegt im Papierkorb" — und das tat der neu gelöschte Entwurf. Er wäre vor Ablauf seiner
    // eigenen 30 Tage endgültig fort gewesen.
    const uhr = { jetzt: GELOESCHT_UM };
    class ZurueckUndWiederGeloescht extends InMemoryDraftRepo {
      override async listTrashed(fuerAutor?: string) {
        const liste = await super.listTrashed(fuerAutor);
        await super.restore("d-1");
        await dienst?.deleteDraft("d-1", "anna");
        return liste;
      }
    }
    const repo = new ZurueckUndWiederGeloescht();
    const dienst = new CaptureService({ repo, now: () => uhr.jetzt });
    await repo.insert(entwurf("d-1"));
    await dienst.deleteDraft("d-1", "anna");

    uhr.jetzt = GELOESCHT_UM + (TRASH_RETENTION_DAYS + 1) * TAG_MS;
    expect(await dienst.runDraftTrashSweep()).toBe(0);
    const frisch = await dienst.findTrashedDraft("d-1");
    expect(frisch?.deletedAt).toBe(new Date(uhr.jetzt).toISOString());
    // Und er bleibt wiederherstellbar.
    expect((await dienst.restoreDraft("d-1")).id).toBe("d-1");
  });

  it("F4c · Die Ablage selbst: `purge` mit Löschzeitpunkt trifft nur genau diesen Stand", async () => {
    const repo = new InMemoryDraftRepo();
    await repo.insert(entwurf("d-1"));
    await repo.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");
    expect(await repo.purge("d-1", false, "2026-09-01T00:00:00.000Z")).toBe(false);
    expect(await repo.findTrashed("d-1")).toBeDefined();
    expect(await repo.purge("d-1", false, "2026-09-12T07:00:00.000Z")).toBe(true);
    expect(await repo.list()).toEqual([]);
  });

  it("F5 · Ein Fehler an einem Entwurf bricht den Lauf nicht ab und wird gemeldet; Unlesbares bleibt liegen", async () => {
    class EinerKlemmt extends InMemoryDraftRepo {
      override purge(id: string, auchLebende?: boolean, geloeschtAm?: string) {
        if (id === "d-klemmt") {
          return Promise.reject(new Error("Ablage nicht erreichbar"));
        }
        return super.purge(id, auchLebende, geloeschtAm);
      }
    }
    const { repo, dienst, uhr } = aufbau(new EinerKlemmt());
    await repo.insert(entwurf("d-klemmt"));
    await repo.insert(entwurf("d-geht"));
    await dienst.deleteDraft("d-klemmt", "anna");
    await dienst.deleteDraft("d-geht", "anna");
    // Ein Papierkorbeintrag mit unlesbarem Zeitpunkt (Altbestand) wird nie geraten gelöscht.
    await repo.insert(entwurf("d-unlesbar"));
    await repo.delete("d-unlesbar", "anna", "kein-zeitpunkt");

    uhr.jetzt = GELOESCHT_UM + (TRASH_RETENTION_DAYS + 1) * TAG_MS;
    const fehler: string[] = [];
    expect(await dienst.runDraftTrashSweep((id) => fehler.push(id))).toBe(1);
    expect(fehler).toEqual(["d-klemmt"]);
    expect((await dienst.listTrashedDrafts()).map((d) => d.id).sort()).toEqual([
      "d-klemmt",
      "d-unlesbar",
    ]);
  });
});

describe("gesamt-papierkorb · der Lauf ist im Server verdrahtet und sein Log ist gelistet", () => {
  const server = readFileSync("services/app/src/server.ts", "utf8");

  it("F6 · beim Start und im Takt des Papierkorb-Sweeps", () => {
    // Einmal direkt beim Start, einmal als `runSweep` des periodischen Schedulers.
    expect(server).toMatch(
      /services\.capture\s*\.runDraftTrashSweep\(entwurfSweepFehler\)\s*\.then/,
    );
    expect(server).toMatch(
      /runSweep: \(\) => services\.capture\.runDraftTrashSweep\(entwurfSweepFehler\)/,
    );
  });

  it("F7 · jede Meldung des Laufs steht auf der Log-Positivliste", () => {
    for (const satz of [
      "Papierkorb-Endlöschung eines Entwurfs fehlgeschlagen",
      "Papierkorb-Endlöschung beim Start: 2 abgelaufene Entwürfe entfernt.",
      "Papierkorb-Endlöschung der Entwürfe beim Start übersprungen",
      "Papierkorb-Endlöschung (periodisch): 3 abgelaufene Entwürfe entfernt.",
      "Periodischer Papierkorb-Sweep der Entwürfe übersprungen",
    ]) {
      expect(gelisteteMeldung(satz), satz).toBe(satz);
    }
    // Die festen Sätze stehen wörtlich in server.ts, die Zählsätze mit ihrem festen Schluss.
    for (const fest of [
      "Papierkorb-Endlöschung eines Entwurfs fehlgeschlagen",
      "Papierkorb-Endlöschung der Entwürfe beim Start übersprungen",
      "Periodischer Papierkorb-Sweep der Entwürfe übersprungen",
      "abgelaufene Entwürfe entfernt.",
      'entwuerfeEntfernt("beim Start")',
      'entwuerfeEntfernt("(periodisch)")',
    ]) {
      expect(server, `server.ts schreibt „${fest}" nicht (mehr)`).toContain(fest);
    }
  });
});
