// ================================================================================================
// AUFNAHME m365-anmeldung · ABMELDEN IM SEITENFENSTER BEENDET AUCH DIE SITZUNG DES DIALOGS
// ================================================================================================
//
// DIE FRAGE: In Word für das Web hält das Seitenfenster den übergebenen Schlüssel, das
// Anmelde-Fenster (top-level, eigene Herkunft) das Cookie. Drückt der Mensch im Seitenfenster
// „Abmelden" und danach „Anmelden", um ein ANDERES Konto zu nehmen — übergibt das Anmelde-Fenster
// dann still wieder das alte? Das geschähe, wenn das Abmelden per Schlüssel nur eine eigene,
// zweite Sitzung beendete und das Cookie des Dialogs weiterlebte.
//
// DER BEFUND AM CODE: das Einlösen gibt das Merkmal DERSELBEN Sitzung heraus
// (`services/auth/src/routes.ts`, Kopf zu `OFFICE_HANDOVER_TTL_MS`). Dieser Fall MISST, was daraus
// folgt, am echten Fastify-Draht:
//   K1  Abmelden mit dem Schlüssel (so ruft das Seitenfenster) → das Cookie des Dialogs trägt
//       nicht mehr: `/api/auth/me` 401, und es gibt keinen neuen Übergabecode mehr.
//   K2  Danach meldet sich im Dialog ein ANDERES Konto an; Code → Einlösen → das Seitenfenster
//       ist das neue Konto, und der alte Schlüssel bleibt tot.
// Was NICHT gemessen ist: derselbe Ablauf in einem echten Office-Web-Host.
import { afterEach, describe, expect, it } from "vitest";
import { anmelden, baueDraht, schliesseOffeneDraehte } from "../demo-zugang-gaeste-route/draht";
import { adminUndGast } from "../demo-zugang-gaeste/aufbau";
import { codeHolenMitCookie, einloesen, ichMitSchluessel } from "./uebergabe";

afterEach(schliesseOffeneDraehte);

function cookieKopf(gesetzt: string | string[] | undefined): string {
  const roh = Array.isArray(gesetzt) ? (gesetzt[0] ?? "") : (gesetzt ?? "");
  const erstes = roh.split(";")[0] ?? "";
  expect(erstes, "die Anmeldung hat kein Sitzungscookie gesetzt").toMatch(/^kw_session=.+/);
  return erstes;
}

describe("Aufnahme m365-anmeldung · Abmelden und Kontowechsel über die Übergabe", () => {
  it("K1 — Abmelden mit dem Schlüssel beendet auch die Cookie-Sitzung des Anmelde-Fensters", async () => {
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const dialogCookie = cookieKopf((await anmelden(app, "gast@x.de")).headers["set-cookie"]);
    const code = (await codeHolenMitCookie(app, dialogCookie)).json().code as string;
    const schluessel = (await einloesen(app, code)).json().token as string;

    // Kalibrierung: vor dem Abmelden tragen BEIDE Nachweise.
    expect((await ichMitSchluessel(app, schluessel)).statusCode).toBe(200);
    const vorher = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: dialogCookie },
    });
    expect(vorher.statusCode).toBe(200);

    // Das Seitenfenster meldet sich ab — mit dem Schlüssel, ohne Cookie.
    const ab = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${schluessel}` },
    });
    expect(ab.statusCode).toBe(204);

    expect((await ichMitSchluessel(app, schluessel)).statusCode).toBe(401);
    const danach = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: dialogCookie },
    });
    expect(danach.statusCode, "das Anmelde-Fenster hielte sonst das alte Konto").toBe(401);
    // Und der Dialog kann das alte Konto nicht mehr still übergeben.
    expect((await codeHolenMitCookie(app, dialogCookie)).statusCode).toBe(401);
  });

  it("K2 — danach übergibt der Dialog das NEUE Konto, und der alte Schlüssel bleibt tot", async () => {
    const { k, app } = await baueDraht();
    const { admin, gast } = await adminUndGast(k);
    const altCookie = cookieKopf((await anmelden(app, "gast@x.de")).headers["set-cookie"]);
    const altCode = (await codeHolenMitCookie(app, altCookie)).json().code as string;
    const altSchluessel = (await einloesen(app, altCode)).json().token as string;
    expect((await ichMitSchluessel(app, altSchluessel)).json().id).toBe(gast.id);
    await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${altSchluessel}` },
    });

    const neuCookie = cookieKopf((await anmelden(app, "admin@x.de")).headers["set-cookie"]);
    const neuCode = (await codeHolenMitCookie(app, neuCookie)).json().code as string;
    const neuSchluessel = (await einloesen(app, neuCode)).json().token as string;

    const ich = await ichMitSchluessel(app, neuSchluessel);
    expect(ich.statusCode).toBe(200);
    expect(ich.json().id).toBe(admin.id);
    expect(ich.json().id).not.toBe(gast.id);
    expect((await ichMitSchluessel(app, altSchluessel)).statusCode).toBe(401);
  });
});
