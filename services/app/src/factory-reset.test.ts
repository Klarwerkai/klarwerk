import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "./build-app";
import { JournalSchreibsperre, buildDevPersistServices } from "./dev-persist";
import { waehleWerksreset } from "./firmenreset-journal";

// R-1154: „Im echten Datenbankbetrieb ist er bewusst abgeschaltet und existiert nur im
// Entwicklermodus". Geprüft wird die Entscheidung, die server.ts beim Start trifft, und der Weg über
// die ECHTE Route bis zum Neustart des Journals.
//
// PETER-20261011-P08 löst die frühere Zusage „danach beginnt die Ersteinrichtung von vorn" ab:
// Konten und Firmenwörterbuch bleiben erhalten, der Neustart braucht KEINE Ersteinrichtung. Den
// vollständigen Kriteriensatz misst `tests/firmenreset-p08/firmenreset-desktop-journal.test.ts`.
function tmpJournal(): string {
  return join(mkdtempSync(join(tmpdir(), "kw-werksreset-")), "state.jsonl");
}

const ADMIN = { name: "Pedi", email: "pedi@example.com", password: "geheim-123" };

describe("R-1154: Werksreset nur im Entwicklermodus", () => {
  it("mit DATABASE_URL unverfügbar — auch wenn zusätzlich ein Journal gesetzt ist", async () => {
    const reset = waehleWerksreset({
      databaseUrl: "postgres://ort/db",
      journal: tmpJournal(),
      beenden: () => {
        throw new Error("darf nie beenden");
      },
    });
    expect(reset.available).toBe(false);
    await expect(reset.run({ kennung: "x", durch: "y" })).rejects.toThrow();
    await expect(reset.vorschau()).rejects.toThrow();
  });

  it("ohne Journal (reiner In-Memory-Betrieb) unverfügbar", () => {
    expect(waehleWerksreset({ databaseUrl: undefined, journal: undefined }).available).toBe(false);
  });

  it("nur mit Dev-Journal und ohne DATABASE_URL verfügbar", () => {
    const reset = waehleWerksreset({ databaseUrl: undefined, journal: tmpJournal() });
    expect(reset.available).toBe(true);
  });
});

describe("R-1154 / R-0537 / P08: Werksreset über die Route → Neustart mit erhaltenem Konto", () => {
  it("falsches Passwort lässt das Journal stehen; vollständige Bestätigung setzt den Bestand zurück", async () => {
    const journal = tmpJournal();
    const sperre = new JournalSchreibsperre();
    let beendet = 0;
    const factoryReset = waehleWerksreset({
      databaseUrl: undefined,
      journal,
      sperre,
      beenden: () => {
        beendet += 1;
      },
    });

    const services = await buildDevPersistServices(journal, sperre);
    const app = buildApp(services, { factoryReset });
    // Ersteinrichtung: der erste Anwender wird Admin.
    const setup = await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
    expect(setup.statusCode).toBe(201);
    const headers = { authorization: `Bearer ${setup.json().token}` };
    await services.capture.createDraft({ title: "Probe", statement: "fiktiv" }, "Pedi");
    const status = await app.inject({ method: "GET", url: "/api/admin/factory-reset", headers });
    const kennung = status.json().vorschau.kennung as string;
    const vorher = readFileSync(journal, "utf8");
    expect(vorher.length).toBeGreaterThan(0);

    // R-0537: ohne erneute (zweifache) Passwortbestätigung bleibt alles, wie es ist.
    const falsch = await app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      headers,
      payload: { kennung, bestaetigt: true, passwort1: ADMIN.password, passwort2: "nicht-meins" },
    });
    expect(falsch.statusCode).toBe(401);
    expect(beendet).toBe(0);
    expect(readFileSync(journal, "utf8")).toBe(vorher);

    const ok = await app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      headers,
      payload: { kennung, bestaetigt: true, passwort1: ADMIN.password, passwort2: ADMIN.password },
    });
    expect(ok.statusCode).toBe(200);
    expect(beendet).toBe(1);
    await app.close();

    // Neustart auf demselben Journal: keine Ersteinrichtung, das Konto meldet sich wieder an,
    // der Entwurf ist weg.
    const neu = await buildDevPersistServices(journal);
    expect(await neu.auth.needsSetup()).toBe(false);
    expect((await neu.auth.login({ email: ADMIN.email, password: ADMIN.password })).user.role).toBe(
      "admin",
    );
    expect(await neu.capture.listDrafts()).toEqual([]);
  });
});
