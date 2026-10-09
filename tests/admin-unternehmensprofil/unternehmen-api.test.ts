// ================================================================================================
// ADMIN-15 · UNTERNEHMENSPROFIL UND INTERNE RICHTLINIEN — AM DRAHT DER ECHTEN APP GEMESSEN.
// ================================================================================================
//
// Fiktives Unternehmen „Nordtal" mit Logo und zwei Richtlinienfassungen. Alle Konten werden hier
// angelegt (isolierte In-Memory-Instanz); kein Kennwort verlässt diese Datei.
//
//   K1 · Profil speichern; Name/Logo nach erneutem Laden (neue App über derselben Ablage) erhalten.
//   K2 · Ungeeignete Dateien und Farben werden mit Grund abgewiesen; nichts wird gespeichert.
//   K3 · Fassung, Datum, Verantwortlichkeit, Geltung; Wirkung vorab, Veröffentlichung nur mit ihr.
//   K4 · Protokoll: Handlung ↔ Person ↔ Fassung; Anzeigen zählt nicht; alte Fassung nicht bestätigbar.
//   K5 · Trennung von Markenwahl, persönlichem Konto und Rechtsseiten; kein Löschweg.
//   K6 · Nur `users.manage` ändert; Prüfprotokoll; Korrektur als neue Fassung; zweite Instanz
//        bleibt unberührt.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { SVG_MIT_SKRIPT, alsLogo, pngLogo } from "../../tests-smoke/support/logo-bild";

type App = ReturnType<typeof buildApp>;
type Kopf = { headers: { authorization: string } };

const KENNWORT = "nordtal-Test-1";

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { headers: { authorization: `Bearer ${res.json().token}` } };
}

async function aufbau(services = buildServices()) {
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin Nordtal", email: "admin@nordtal.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@nordtal.test");
  const konten: Record<string, string> = {};
  for (const [name, email, role] of [
    ["Erika Experte", "erika@nordtal.test", "experte"],
    ["Carl Controller", "carl@nordtal.test", "controller"],
    ["Vera Betrachterin", "vera@nordtal.test", "viewer"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      ...admin,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, res.body).toBe(201);
    konten[role] = res.json().id;
  }
  return {
    app,
    services,
    admin,
    konten,
    erika: await anmelden(app, "erika@nordtal.test"),
    carl: await anmelden(app, "carl@nordtal.test"),
    vera: await anmelden(app, "vera@nordtal.test"),
  };
}

const LOGO = alsLogo(pngLogo(160, 48), "image/png");

const RICHTLINIE = {
  titel: "Hausordnung Nordtal",
  text: "Besucher melden sich am Empfang an.\nTüren zum Lager bleiben geschlossen.",
  verantwortlich: "Personalabteilung Nordtal",
  gueltigAb: "2026-10-12",
  rollen: [],
  anforderung: "kenntnisnahme",
};

describe("K1/K2/K6 · Unternehmensprofil", () => {
  it("K1 · Nordtal mit Logo speichern — nach erneutem Laden und für jedes Konto lesbar", async () => {
    const { app, services, admin, erika } = await aufbau();
    const vorher = await app.inject({ method: "GET", url: "/api/unternehmensprofil", ...erika });
    expect(vorher.json()).toEqual({ version: 0, profil: null });

    const put = await app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      ...admin,
      payload: {
        version: 0,
        name: "  Nordtal Werkzeugbau GmbH ",
        logo: LOGO,
        akzent: "tannengruen",
      },
    });
    expect(put.statusCode, put.body).toBe(200);
    expect(put.json()).toMatchObject({
      version: 1,
      name: "Nordtal Werkzeugbau GmbH",
      akzent: "tannengruen",
      logo: { typ: "image/png", breite: 160, hoehe: 48 },
      uebernommenAus: null,
    });

    // „Reload": eine neue App über derselben Ablage — nichts lebt nur im Speicher der Seite.
    const neu = buildApp(services);
    const lesen = await neu.inject({ method: "GET", url: "/api/unternehmensprofil", ...erika });
    expect(lesen.statusCode).toBe(200);
    expect(lesen.json()).toEqual({
      version: 1,
      profil: {
        name: "Nordtal Werkzeugbau GmbH",
        logo: { typ: "image/png", daten: LOGO.daten, breite: 160, hoehe: 48 },
        akzent: { id: "tannengruen", flaeche: "#1e5631", schrift: "#ffffff" },
      },
    });
    // Ohne Anmeldung gibt es kein Profil.
    expect((await neu.inject({ method: "GET", url: "/api/unternehmensprofil" })).statusCode).toBe(
      401,
    );
  });

  it("K2 · SVG, falscher Inhalt, zu kleines Bild und freie Farbe werden erklärt abgewiesen", async () => {
    const { app, admin } = await aufbau();
    const versuche = [
      { logo: alsLogo(SVG_MIT_SKRIPT, "image/svg+xml"), code: "LOGO_TYP", text: /SVG/ },
      { logo: alsLogo(SVG_MIT_SKRIPT, "image/png"), code: "LOGO_INHALT", text: /Bildformat/ },
      { logo: alsLogo(pngLogo(20, 20), "image/png"), code: "LOGO_MASSE", text: /Pixel/ },
      { logo: alsLogo(pngLogo(500, 40), "image/png"), code: "LOGO_FORMAT", text: /lesbar/ },
    ];
    for (const v of versuche) {
      const res = await app.inject({
        method: "PUT",
        url: "/api/admin/unternehmensprofil",
        ...admin,
        payload: { version: 0, name: "Nordtal", logo: v.logo, akzent: "nachtblau" },
      });
      expect(res.statusCode, v.code).toBe(400);
      expect(res.json().error).toBe(v.code);
      expect(res.json().message).toMatch(v.text);
    }
    const farbe = await app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      ...admin,
      payload: { version: 0, name: "Nordtal", logo: null, akzent: "#ff00ff" },
    });
    expect(farbe.json().error).toBe("AKZENT_UNBEKANNT");
    // Nichts davon wurde gespeichert.
    const stand = await app.inject({
      method: "GET",
      url: "/api/admin/unternehmensprofil",
      ...admin,
    });
    expect(stand.json().fassungen).toEqual([]);
    // Die Verwaltung bekommt die Gestaltungsoptionen samt gerechnetem Kontrast.
    for (const a of stand.json().akzente as { kontrast: number }[]) {
      expect(a.kontrast).toBeGreaterThanOrEqual(7);
    }
  });

  it("K6 · nur die Verwaltung ändert; Korrektur ist eine neue Fassung; Protokoll ohne Logodatei", async () => {
    const { app, services, admin, erika, carl, vera } = await aufbau();
    const nutzlast = { version: 0, name: "Nordtal", logo: LOGO, akzent: "nachtblau" };
    for (const k of [erika, carl, vera]) {
      const res = await app.inject({
        method: "PUT",
        url: "/api/admin/unternehmensprofil",
        ...k,
        payload: nutzlast,
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
      expect(
        (await app.inject({ method: "GET", url: "/api/admin/unternehmensprofil", ...k }))
          .statusCode,
      ).toBe(403);
    }
    const anon = await app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      payload: nutzlast,
    });
    expect(anon.statusCode).toBe(401);

    const v1 = await app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      ...admin,
      payload: nutzlast,
    });
    expect(v1.statusCode).toBe(200);
    const v2 = await app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      ...admin,
      payload: { version: 1, name: "Nordtal AG", logo: null, akzent: "anthrazit" },
    });
    expect(v2.statusCode).toBe(200);
    // Ein zweiter Bearbeiter mit veraltetem Stand überschreibt nichts.
    const veraltet = await app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      ...admin,
      payload: { version: 1, name: "Nordtal Alt", logo: null, akzent: "neutral" },
    });
    expect(veraltet.statusCode).toBe(409);
    expect(veraltet.json()).toMatchObject({ error: "VERSION_VERALTET", aktuelleVersion: 2 });
    // Korrektur: Fassung 1 übernehmen — ohne Grund abgewiesen, mit Grund eine neue Fassung 3.
    const ohneGrund = await app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      ...admin,
      payload: { ...nutzlast, version: 2, uebernommenAus: 1 },
    });
    expect(ohneGrund.json().error).toBe("GRUND_FEHLT");
    const v3 = await app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      ...admin,
      payload: { ...nutzlast, version: 2, uebernommenAus: 1, grund: "Umfirmierung zurückgenommen" },
    });
    expect(v3.statusCode, v3.body).toBe(200);
    const verlauf = await app.inject({
      method: "GET",
      url: "/api/admin/unternehmensprofil",
      ...admin,
    });
    const fassungen = verlauf.json().fassungen as {
      version: number;
      name: string;
      uebernommenAus: number | null;
      grund: string | null;
    }[];
    expect(fassungen.map((f) => [f.version, f.name, f.uebernommenAus])).toEqual([
      [1, "Nordtal", null],
      [2, "Nordtal AG", null],
      [3, "Nordtal", 1],
    ]);
    expect(fassungen[2]?.grund).toBe("Umfirmierung zurückgenommen");

    const protokoll = await services.audit.list({ action: "unternehmensprofil.geaendert" });
    expect(protokoll.map((e) => e.payload.version)).toEqual([1, 2, 3]);
    expect(protokoll[2]?.payload).toMatchObject({ vorherVersion: 2, uebernommenAus: 1 });
    expect(JSON.stringify(protokoll)).not.toContain(LOGO.daten.slice(0, 40));
  });

  it("K6 · eine zweite Instanz (andere Organisation) sieht und ändert nichts davon", async () => {
    const nordtal = await aufbau();
    const andere = await aufbau();
    await nordtal.app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      ...nordtal.admin,
      payload: { version: 0, name: "Nordtal", logo: LOGO, akzent: "aubergine" },
    });
    const dort = await andere.app.inject({
      method: "GET",
      url: "/api/unternehmensprofil",
      ...andere.erika,
    });
    expect(dort.json()).toEqual({ version: 0, profil: null });
    // Die Sitzung aus Nordtal gilt in der anderen Instanz nicht.
    const fremd = await andere.app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      ...nordtal.admin,
      payload: { version: 0, name: "Übernahme", logo: null, akzent: "neutral" },
    });
    expect(fremd.statusCode).toBe(401);
  });
});

async function veroeffentlichen(
  app: App,
  admin: Kopf,
  eingabe: Record<string, unknown>,
  id?: string,
) {
  const wirkung = await app.inject({
    method: "POST",
    url: "/api/admin/richtlinien/wirkung",
    ...admin,
    payload: { id: id ?? null, anforderung: eingabe.anforderung, rollen: eingabe.rollen },
  });
  expect(wirkung.statusCode, wirkung.body).toBe(200);
  const res = await app.inject({
    method: "POST",
    url: id ? `/api/admin/richtlinien/${id}/fassungen` : "/api/admin/richtlinien",
    ...admin,
    payload: { ...eingabe, wirkung: wirkung.json() },
  });
  expect(res.statusCode, res.body).toBe(201);
  return { wirkung: wirkung.json(), fassung: res.json().fassung };
}

describe("K3/K4/K5/K6 · Interne Richtlinien mit zwei Fassungen", () => {
  it("K3 · Fassung, Datum, Verantwortlichkeit, Geltung; ohne gesehene Wirkung keine Veröffentlichung", async () => {
    const { app, admin } = await aufbau();
    const ohne = await app.inject({
      method: "POST",
      url: "/api/admin/richtlinien",
      ...admin,
      payload: RICHTLINIE,
    });
    expect(ohne.statusCode).toBe(409);
    expect(ohne.json().error).toBe("WIRKUNG_NICHT_BESTAETIGT");
    // Die Antwort nennt die Wirkung, die angezeigt werden muss: 4 freigegebene Konten.
    expect(ohne.json().wirkung).toEqual({
      verlangt: "kenntnisnahme",
      erneut: false,
      betroffen: 4,
      bisherigeFassung: null,
      bisherigeHandlungen: 0,
    });
    const falsch = await app.inject({
      method: "POST",
      url: "/api/admin/richtlinien",
      ...admin,
      payload: { ...RICHTLINIE, wirkung: { verlangt: "anzeige", betroffen: 4 } },
    });
    expect(falsch.statusCode).toBe(409);

    const { fassung } = await veroeffentlichen(app, admin, RICHTLINIE);
    expect(fassung).toMatchObject({
      fassung: 1,
      titel: "Hausordnung Nordtal",
      verantwortlich: "Personalabteilung Nordtal",
      gueltigAb: "2026-10-12",
      rollen: [],
      anforderung: "kenntnisnahme",
      aenderungsgrund: null,
    });
    expect(typeof fassung.veroeffentlichtAm).toBe("string");
    // Ab Fassung 2 ist ein Änderungsgrund Pflicht.
    const ohneGrund = await app.inject({
      method: "POST",
      url: `/api/admin/richtlinien/${fassung.id}/fassungen`,
      ...admin,
      payload: { ...RICHTLINIE, gesehen: 1 },
    });
    expect(ohneGrund.json().error).toBe("GRUND_FEHLT");
  });

  it("K4 · Anzeigen zählt nicht; jede Handlung hängt an Person UND Fassung; Fassung 2 verlangt erneut", async () => {
    const { app, services, admin, konten, erika, vera } = await aufbau();
    const { fassung: f1 } = await veroeffentlichen(app, admin, RICHTLINIE);

    // Erika und Vera SEHEN die Richtlinie — mehrmals. Das ist keine Handlung.
    for (const k of [erika, vera, erika]) {
      const liste = await app.inject({ method: "GET", url: "/api/richtlinien", ...k });
      expect(liste.json().richtlinien).toMatchObject([
        { id: f1.id, fassung: 1, meineHandlung: null },
      ]);
    }
    const leer = await app.inject({
      method: "GET",
      url: `/api/admin/richtlinien/${f1.id}/protokoll`,
      ...admin,
    });
    expect(leer.json().eintraege).toEqual([]);

    // Eine Zustimmung, wo Kenntnisnahme verlangt ist, gibt es nicht.
    const unpassend = await app.inject({
      method: "POST",
      url: `/api/richtlinien/${f1.id}/handlungen`,
      ...erika,
      payload: { fassung: 1, handlung: "zustimmung" },
    });
    expect(unpassend.json().error).toBe("HANDLUNG_UNPASSEND");
    // Erika nimmt Fassung 1 zur Kenntnis — ein Doppelklick ändert nichts.
    const erste = await app.inject({
      method: "POST",
      url: `/api/richtlinien/${f1.id}/handlungen`,
      ...erika,
      payload: { fassung: 1, handlung: "kenntnisnahme" },
    });
    expect(erste.statusCode, erste.body).toBe(201);
    const nochmal = await app.inject({
      method: "POST",
      url: `/api/richtlinien/${f1.id}/handlungen`,
      ...erika,
      payload: { fassung: 1, handlung: "kenntnisnahme" },
    });
    expect(nochmal.statusCode).toBe(200);
    expect(nochmal.json()).toMatchObject({ bereits: true, am: erste.json().am });

    // Fassung 2 verlangt Zustimmung — die Wirkung sagt vorab: erneut, 4 Konten, 1 alte Handlung.
    const { wirkung, fassung: f2 } = await veroeffentlichen(
      app,
      admin,
      {
        ...RICHTLINIE,
        text: `${RICHTLINIE.text}\nFotografieren in der Fertigung nur mit Freigabe.`,
        anforderung: "zustimmung",
        gesehen: 1,
        aenderungsgrund: "Fotoregel ergänzt",
      },
      f1.id,
    );
    expect(wirkung).toEqual({
      verlangt: "zustimmung",
      erneut: true,
      betroffen: 4,
      bisherigeFassung: 1,
      bisherigeHandlungen: 1,
    });
    expect(f2).toMatchObject({ id: f1.id, fassung: 2, aenderungsgrund: "Fotoregel ergänzt" });

    // Erikas Kenntnisnahme zu Fassung 1 gilt NICHT für Fassung 2.
    const nachher = await app.inject({ method: "GET", url: "/api/richtlinien", ...erika });
    expect(nachher.json().richtlinien).toMatchObject([
      { fassung: 2, anforderung: "zustimmung", meineHandlung: null },
    ]);
    // Fassung 1 lässt sich nicht mehr bestätigen.
    const alt = await app.inject({
      method: "POST",
      url: `/api/richtlinien/${f1.id}/handlungen`,
      ...vera,
      payload: { fassung: 1, handlung: "kenntnisnahme" },
    });
    expect(alt.statusCode).toBe(409);
    expect(alt.json()).toMatchObject({ error: "FASSUNG_VERALTET", aktuelleFassung: 2 });
    const zustimmung = await app.inject({
      method: "POST",
      url: `/api/richtlinien/${f1.id}/handlungen`,
      ...erika,
      payload: { fassung: 2, handlung: "zustimmung" },
    });
    expect(zustimmung.statusCode).toBe(201);

    const protokoll = await app.inject({
      method: "GET",
      url: `/api/admin/richtlinien/${f1.id}/protokoll`,
      ...admin,
    });
    expect(
      (
        protokoll.json().eintraege as {
          personId: string;
          personName: string;
          fassung: number;
          handlung: string;
        }[]
      ).map((e) => [e.personName, e.personId, e.fassung, e.handlung]),
    ).toEqual([
      ["Erika Experte", konten.experte, 1, "kenntnisnahme"],
      ["Erika Experte", konten.experte, 2, "zustimmung"],
    ]);
    expect(protokoll.json().fassungen.map((f: { fassung: number }) => f.fassung)).toEqual([1, 2]);

    // Der Verwaltungsüberblick zählt nur Handlungen zur AKTUELLEN Fassung.
    const ueberblick = await app.inject({ method: "GET", url: "/api/admin/richtlinien", ...admin });
    expect(ueberblick.json().richtlinien).toMatchObject([
      { aktuell: { fassung: 2 }, stand: { betroffen: 4, erledigt: 1 } },
    ]);
    // Und das Prüfprotokoll hält Veröffentlichung und Handlungen fest — ohne Richtlinientext.
    const audit = await services.audit.list({ target: f1.id });
    expect(audit.map((e) => e.action)).toEqual([
      "richtlinie.veroeffentlicht",
      "richtlinie.handlung",
      "richtlinie.veroeffentlicht",
      "richtlinie.handlung",
    ]);
    expect(JSON.stringify(audit)).not.toContain("Fotografieren");
  });

  it("K3/K6 · Geltung nach Rolle; Rechte für Pflege, Wirkung und Protokoll nur bei der Verwaltung", async () => {
    const { app, admin, erika, carl, vera } = await aufbau();
    const { wirkung, fassung } = await veroeffentlichen(app, admin, {
      ...RICHTLINIE,
      titel: "Prüfmittelregel Nordtal",
      rollen: ["controller"],
      anforderung: "zustimmung",
    });
    expect(wirkung.betroffen).toBe(1);
    // Carl sieht sie, Vera nicht — und Vera kann ihr nicht zustimmen.
    expect(
      (await app.inject({ method: "GET", url: "/api/richtlinien", ...carl })).json().richtlinien,
    ).toHaveLength(1);
    expect(
      (await app.inject({ method: "GET", url: "/api/richtlinien", ...vera })).json().richtlinien,
    ).toEqual([]);
    const fremd = await app.inject({
      method: "POST",
      url: `/api/richtlinien/${fassung.id}/handlungen`,
      ...vera,
      payload: { fassung: 1, handlung: "zustimmung" },
    });
    expect(fremd.statusCode).toBe(404);

    for (const k of [erika, carl, vera]) {
      for (const [method, url, payload] of [
        ["GET", "/api/admin/richtlinien", undefined],
        ["GET", `/api/admin/richtlinien/${fassung.id}/protokoll`, undefined],
        ["POST", "/api/admin/richtlinien/wirkung", { anforderung: "anzeige", rollen: [] }],
        ["POST", "/api/admin/richtlinien", { ...RICHTLINIE, wirkung }],
        ["POST", `/api/admin/richtlinien/${fassung.id}/fassungen`, { ...RICHTLINIE, gesehen: 1 }],
      ] as const) {
        const res = await app.inject({ method, url, ...k, ...(payload ? { payload } : {}) });
        expect(res.statusCode, `${method} ${url}`).toBe(403);
      }
    }
    // Es entstand dabei keine weitere Fassung.
    const liste = await app.inject({ method: "GET", url: "/api/admin/richtlinien", ...admin });
    expect(liste.json().richtlinien).toHaveLength(1);
    expect(liste.json().richtlinien[0].fassungen).toHaveLength(1);
  });

  it("K5 · kein Löschweg für Handlungen oder Fassungen; Markenwahl, Konto und Rechtsseiten bleiben getrennt", async () => {
    const { app, admin, erika } = await aufbau();
    const branding = (await app.inject({ method: "GET", url: "/api/branding" })).json();
    const ich = (await app.inject({ method: "GET", url: "/api/auth/me", ...erika })).json();
    const { fassung } = await veroeffentlichen(app, admin, RICHTLINIE);
    await app.inject({
      method: "POST",
      url: `/api/richtlinien/${fassung.id}/handlungen`,
      ...erika,
      payload: { fassung: 1, handlung: "kenntnisnahme" },
    });
    await app.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      ...admin,
      payload: { version: 0, name: "Nordtal", logo: LOGO, akzent: "nachtblau" },
    });

    // Kein Weg, Handlungen oder Fassungen zu löschen — auch nicht für die Verwaltung.
    for (const url of [
      `/api/admin/richtlinien/${fassung.id}/protokoll`,
      `/api/admin/richtlinien/${fassung.id}`,
      `/api/admin/richtlinien/${fassung.id}/fassungen`,
      `/api/richtlinien/${fassung.id}/handlungen`,
      "/api/admin/richtlinien",
      "/api/admin/unternehmensprofil",
    ]) {
      const res = await app.inject({ method: "DELETE", url, ...admin });
      expect(res.statusCode, `DELETE ${url}`).toBe(404);
    }
    const protokoll = await app.inject({
      method: "GET",
      url: `/api/admin/richtlinien/${fassung.id}/protokoll`,
      ...admin,
    });
    expect(protokoll.json().eintraege).toHaveLength(1);

    // Die feste Markenwahl und das persönliche Konto sind unverändert.
    expect((await app.inject({ method: "GET", url: "/api/branding" })).json()).toEqual(branding);
    expect((await app.inject({ method: "GET", url: "/api/auth/me", ...erika })).json()).toEqual(
      ich,
    );
  });
});
