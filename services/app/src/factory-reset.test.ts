import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "./build-app";
import { buildDevPersistServices } from "./dev-persist";
import { waehleWerksreset } from "./factory-reset";

// R-1154: „Im echten Datenbankbetrieb ist er bewusst abgeschaltet und existiert nur im
// Entwicklermodus" und „danach beginnt die Ersteinrichtung von vorn". Geprüft wird die Entscheidung,
// die server.ts beim Start trifft, und der Weg über die ECHTE Route bis zum Neustart des Journals.
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
    await expect(reset.run()).rejects.toThrow();
  });

  it("ohne Journal (reiner In-Memory-Betrieb) unverfügbar", () => {
    expect(waehleWerksreset({ databaseUrl: undefined, journal: undefined }).available).toBe(false);
  });

  it("nur mit Dev-Journal und ohne DATABASE_URL verfügbar", () => {
    const reset = waehleWerksreset({ databaseUrl: undefined, journal: tmpJournal() });
    expect(reset.available).toBe(true);
  });
});

describe("R-1154 / R-0537: Werksreset über die Route → nach Neustart Ersteinrichtung", () => {
  it("falsches Passwort lässt das Journal stehen; richtiges leert es → needsSetup", async () => {
    const journal = tmpJournal();
    let beendet = 0;
    const factoryReset = waehleWerksreset({
      databaseUrl: undefined,
      journal,
      beenden: () => {
        beendet += 1;
      },
    });

    const app = buildApp(await buildDevPersistServices(journal), { factoryReset });
    // Ersteinrichtung: der erste Anwender wird Admin.
    const setup = await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
    expect(setup.statusCode).toBe(201);
    const headers = { authorization: `Bearer ${setup.json().token}` };
    const vorher = await app.inject({ method: "GET", url: "/api/auth/status" });
    expect(vorher.json().needsSetup).toBe(false);
    expect(readFileSync(journal, "utf8").length).toBeGreaterThan(0);

    // R-0537: ohne erneute Passwortbestätigung bleibt alles, wie es ist.
    const falsch = await app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      headers,
      payload: { password: "nicht-meins" },
    });
    expect(falsch.statusCode).toBe(401);
    expect(beendet).toBe(0);
    expect(readFileSync(journal, "utf8").length).toBeGreaterThan(0);

    const ok = await app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      headers,
      payload: { password: ADMIN.password },
    });
    expect(ok.statusCode).toBe(200);
    // Die Route stößt den Reset nach dem Senden an; einen Takt abwarten.
    await new Promise((r) => setTimeout(r, 0));
    expect(beendet).toBe(1);
    expect(readFileSync(journal, "utf8")).toBe("");
    await app.close();

    // Neustart auf demselben Journal: leere Instanz, die Ersteinrichtung beginnt von vorn.
    const neu = buildApp(await buildDevPersistServices(journal));
    const status = await neu.inject({ method: "GET", url: "/api/auth/status" });
    expect(status.json().needsSetup).toBe(true);
    await neu.close();
  });
});
