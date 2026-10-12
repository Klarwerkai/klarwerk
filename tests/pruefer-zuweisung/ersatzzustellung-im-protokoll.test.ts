// ================================================================================================
// R-0679 / FR-VAL-07 — ZUWEISUNG OHNE MAILSERVER: DIE NACHRICHT LANDET ERSATZWEISE IM PROTOKOLL.
// ================================================================================================
//
// Am Draht, nicht am Modul: die echte App ohne `SMTP_HOST` (sammelnder Fallback), eine echte
// Zuweisung über `PUT /api/kos/:id` (`action: "assign"`), und gelesen wird die echte Logsenke der
// App. Belegt wird zweierlei:
//   · die Zuweisung hinterlässt eine Zeile `mail_ersatzzustellung` mit dem Betreff;
//   · in keiner Logzeile steht die Adresse der Zugewiesenen.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { ConsoleMailer } from "../../services/notifications";

const PASSWORT = "geheim12345";

describe("R-0679 · Zuweisung ohne Mailserver", () => {
  it("E1 · die Nachricht steht ersatzweise im Protokoll — Betreff ja, Adresse nein", async () => {
    const services = buildServices();
    const logzeilen: string[] = [];
    // Die Testumgebung stellt das Log stumm (`tests/setup-env.ts`); hier wird es gelesen.
    const app = buildApp(services, {
      log: { senke: { write: (z) => logzeilen.push(z) }, stufe: "info" },
    });
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada", email: "ada@r0679.test", password: PASSWORT },
    });
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ada@r0679.test", password: PASSWORT },
    });
    const admin = { authorization: `Bearer ${anmeldung.json().token}` };
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: "Pia", email: "pia@r0679.test", password: PASSWORT, role: "experte" },
    });
    expect(angelegt.statusCode).toBe(201);
    const pia = (await services.auth.listUsers()).find((u) => u.email === "pia@r0679.test");
    if (!pia) {
      throw new Error("Konto Pia fehlt");
    }
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        confidentiality: "intern",
        title: "Hydraulikdruck vor Wartung ablassen",
        statement: "Vor dem Öffnen den Druck ablassen.",
        type: "best_practice",
        category: "Hydraulik",
        neededValidations: 1,
      },
    });
    expect(ko.statusCode).toBe(201);

    const zuweisung = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.json().id}`,
      headers: admin,
      payload: { action: "assign", userIds: [pia.id] },
    });
    expect(zuweisung.statusCode).toBe(204);

    // Vorbedingung: es lief wirklich der sammelnde Fallback (kein SMTP in der Testumgebung).
    expect((services.mailer as ConsoleMailer).sent.map((m) => m.to)).toEqual(["pia@r0679.test"]);

    const ersatz = logzeilen
      .map((z) => JSON.parse(z) as Record<string, unknown>)
      .filter((z) => z.event === "mail_ersatzzustellung");
    expect(ersatz).toHaveLength(1);
    expect(ersatz[0]?.betreff).toBe("KLARWERK: Wissensobjekt zur Validierung zugewiesen");
    expect(logzeilen.join("\n")).not.toContain("pia@r0679.test");
    await app.close();
  });
});
