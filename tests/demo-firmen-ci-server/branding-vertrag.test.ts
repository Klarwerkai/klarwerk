// ================================================================================================
// JOB 3510 · DEMO-FIRMEN-CI SERVER — DIE EINE ZENTRALE MARKENWAHL, ÜBER HTTP GEMESSEN.
// ================================================================================================
//
// Für die Vorführung sollen KLARWERK, Klara/Word und die Chrome-Erweiterung DASSELBE zeigen. Das
// geht nur über EINE gespeicherte Wahl auf dem Server. Diese Datei misst den Vertrag, gegen den
// JOB 3511 (Web + Admin) und JOB 3512 (Word + Chrome) bauen — an der echten App, per `inject`,
// nicht an einer nachgebauten Vorstellung davon.
//
// WARUM DIE VORGABE EIN EIGENER FALL IST: Eine frisch aufgesetzte Instanz muss normal aussehen.
// Ein vorbelegtes Advisor-Profil wäre der Fehler, den niemand meldet, weil er wie eine Funktion
// aussieht — deshalb steht `profil: null, aktiv: false, version: 0, marke: null` als erster Fall.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { demoKennwort } from "../support/demoZugang";

type App = ReturnType<typeof buildApp>;

async function login(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { headers: { authorization: `Bearer ${res.json().token}` } };
}

// Ein Admin (users.manage) und ein Experte (ohne users.manage) an DERSELBEN App — die Rechtefrage
// aus Lieferung 4 lässt sich nur an zwei echten Konten messen, nicht an einem gefälschten Guard.
async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const admin = await login(app, "a@x.de", "secret123");
  const seed = await app.inject({
    method: "POST",
    url: "/api/admin/demo-seed",
    headers: admin.headers,
  });
  const erik = await login(app, "erik@demo.klarwerk", demoKennwort(seed, "erik@demo.klarwerk"));
  return { app, services, admin, erik };
}

describe("JOB 3510: die zentrale Markenwahl", () => {
  it("Lieferung 6 — die Vorgabe ist AUS: kein Profil, keine Marke, Version 0", async () => {
    const { app } = await aufbau();
    const res = await app.inject({ method: "GET", url: "/api/branding" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ profil: null, aktiv: false, version: 0, marke: null });
  });

  it("Lieferung 3 — der Adminweg setzt, der Leseweg liefert dieselbe Gestalt mit der Marke", async () => {
    const { app, admin } = await aufbau();
    const put = await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      headers: admin.headers,
      payload: { profil: "advisor", aktiv: true },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({
      profil: "advisor",
      aktiv: true,
      version: 1,
      marke: {
        name: "Advisor",
        farben: { primaer: "#0578b7", schrift: "#161417" },
        logo: "/marke/advisor/adv-logo.svg",
      },
    });

    // Der Leseweg ist OHNE Adminrecht erreichbar — Word-Taskpane und Chrome-Panel lesen hier.
    const get = await app.inject({ method: "GET", url: "/api/branding" });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual(put.json());
  });

  it("Lieferung 3 — `version` steigt bei JEDER Änderung, auch wenn nur `aktiv` kippt", async () => {
    const { app, admin } = await aufbau();
    const setze = async (payload: { profil: string | null; aktiv: boolean }) => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/admin/branding",
        headers: admin.headers,
        payload,
      });
      return res.json();
    };

    expect((await setze({ profil: "advisor", aktiv: true })).version).toBe(1);
    // Nur der Schalter kippt, das Profil bleibt: eine bereits geöffnete Oberfläche erkennt das
    // AUSSCHLIESSLICH an der Version. Bliebe sie stehen, bliebe die Fläche gefärbt.
    expect((await setze({ profil: "advisor", aktiv: false })).version).toBe(2);
    // Und selbst eine Wiederholung derselben Wahl ist eine Änderung des Standes.
    expect((await setze({ profil: "advisor", aktiv: false })).version).toBe(3);
    expect((await app.inject({ method: "GET", url: "/api/branding" })).json().version).toBe(3);
  });

  it("Lieferung 8 — Ausschalten nimmt die Marke zurück, das Profil bleibt gewählt", async () => {
    const { app, admin } = await aufbau();
    await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      headers: admin.headers,
      payload: { profil: "advisor", aktiv: true },
    });
    const aus = await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      headers: admin.headers,
      payload: { profil: "advisor", aktiv: false },
    });
    expect(aus.json().marke).toBeNull();
    expect(aus.json().profil).toBe("advisor");
    expect((await app.inject({ method: "GET", url: "/api/branding" })).json().marke).toBeNull();
  });

  it("Lieferung 4 — ohne `users.manage` ändert sich die Wahl NICHT", async () => {
    const { app, admin, erik } = await aufbau();
    await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      headers: admin.headers,
      payload: { profil: "advisor", aktiv: true },
    });
    const vorher = (await app.inject({ method: "GET", url: "/api/branding" })).json();

    const verboten = await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      headers: erik.headers,
      payload: { profil: null, aktiv: false },
    });
    expect(verboten.statusCode).toBe(403);

    // Der Beweis ist nicht der Statuscode, sondern der unveränderte Stand — inklusive Version.
    expect((await app.inject({ method: "GET", url: "/api/branding" })).json()).toEqual(vorher);
  });

  it("Lieferung 4 — ganz ohne Anmeldung ändert sich die Wahl NICHT", async () => {
    const { app } = await aufbau();
    const ohne = await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      payload: { profil: "advisor", aktiv: true },
    });
    expect(ohne.statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/branding" })).json()).toEqual({
      profil: null,
      aktiv: false,
      version: 0,
      marke: null,
    });
  });

  it("Lieferung 7 — ein unbekanntes Profil wird abgelehnt (400) und nicht still gespeichert", async () => {
    const { app, admin } = await aufbau();
    for (const payload of [
      { profil: "acme", aktiv: true },
      { profil: "ADVISOR", aktiv: true },
      { profil: 7, aktiv: true },
      { profil: "advisor", aktiv: "ja" },
      { profil: "advisor" },
      {},
    ]) {
      const res = await app.inject({
        method: "PUT",
        url: "/api/admin/branding",
        headers: admin.headers,
        payload,
      });
      expect(res.statusCode, `abgelehnt werden muss: ${JSON.stringify(payload)}`).toBe(400);
    }
    // Nach sechs abgewiesenen Versuchen steht die Vorgabe unverändert da — auch die Version.
    expect((await app.inject({ method: "GET", url: "/api/branding" })).json()).toEqual({
      profil: null,
      aktiv: false,
      version: 0,
      marke: null,
    });
  });

  it("Lieferung 4 — jede erfolgreiche Änderung schreibt einen Audit-Eintrag mit altem und neuem Wert", async () => {
    const { app, services, admin } = await aufbau();
    const ich = (
      await app.inject({ method: "GET", url: "/api/auth/me", headers: admin.headers })
    ).json();

    await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      headers: admin.headers,
      payload: { profil: "advisor", aktiv: true },
    });
    await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      headers: admin.headers,
      payload: { profil: null, aktiv: false },
    });

    const eintraege = await services.audit.list({ action: "branding.set" });
    expect(eintraege).toHaveLength(2);
    const [erster, zweiter] = eintraege;
    expect(erster?.actor).toBe(ich.id);
    expect(erster?.payload).toMatchObject({
      vorherProfil: null,
      vorherAktiv: false,
      profil: "advisor",
      aktiv: true,
      version: 1,
    });
    expect(zweiter?.payload).toMatchObject({
      vorherProfil: "advisor",
      vorherAktiv: true,
      profil: null,
      aktiv: false,
      version: 2,
    });

    // Der abgewiesene Versuch schreibt NICHTS — ein Protokoll, das Fehlversuche als Änderungen
    // führt, macht die Nachvollziehbarkeit wertlos.
    await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      headers: admin.headers,
      payload: { profil: "acme", aktiv: true },
    });
    expect(await services.audit.list({ action: "branding.set" })).toHaveLength(2);
  });

  it("Lieferung 5 — Umschalten rührt Demodaten und KI nicht an", async () => {
    const { app, services, admin } = await aufbau();
    const bestandVorher = (await services.ko.list()).length;
    const demoVorher = (
      await app.inject({ method: "GET", url: "/api/admin/demo-seed", headers: admin.headers })
    ).json();
    const laeufeVorher = (await services.modelRuns.recent(200)).length;

    for (const payload of [
      { profil: "advisor", aktiv: true },
      { profil: "advisor", aktiv: false },
      { profil: null, aktiv: false },
    ]) {
      const res = await app.inject({
        method: "PUT",
        url: "/api/admin/branding",
        headers: admin.headers,
        payload,
      });
      expect(res.statusCode).toBe(200);
    }

    expect((await services.ko.list()).length).toBe(bestandVorher);
    expect(
      (
        await app.inject({ method: "GET", url: "/api/admin/demo-seed", headers: admin.headers })
      ).json(),
    ).toEqual(demoVorher);
    expect((await services.modelRuns.recent(200)).length).toBe(laeufeVorher);
  });

  it("die Wahl gilt instanzweit — zwei Leser sehen denselben Stand, nicht je einen eigenen", async () => {
    const { app, admin, erik } = await aufbau();
    await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      headers: admin.headers,
      payload: { profil: "advisor", aktiv: true },
    });
    const alsAdmin = await app.inject({
      method: "GET",
      url: "/api/branding",
      headers: admin.headers,
    });
    const alsErik = await app.inject({
      method: "GET",
      url: "/api/branding",
      headers: erik.headers,
    });
    const ohneAnmeldung = await app.inject({ method: "GET", url: "/api/branding" });
    expect(alsAdmin.json()).toEqual(alsErik.json());
    expect(alsErik.json()).toEqual(ohneAnmeldung.json());
    expect(ohneAnmeldung.json().marke.farben.primaer).toBe("#0578b7");
  });
});
