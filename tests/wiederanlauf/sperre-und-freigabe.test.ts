// ================================================================================================
// produkt:20261011:peter-p09 · P09-AC05 — LÖSCHMARKIERUNGEN UND RECHTEENTZUG VOR DER FREIGABE.
// ================================================================================================
//
// Peters Entscheidung 45: „Zuerst Integrität, Rechteentzüge und Löschmarkierungen nachführen;
// anschließend Suche und Bibliothek öffnen." Gemessen an der echten Anwendung (`buildApp`, `inject`)
// mit dem fiktiven Bestand aus `tests/wiederherstellung-export/bestand.ts`. Die Anwendung im
// Wiederanlauf liest dieselbe Ablage wie die Quelle — im Speicherbetrieb das Gegenstück zu einer
// wiederhergestellten Datenbank (die echte Restore-Strecke misst
// `isolierter-wiederanlauf.integration.test.ts`).
//
//   S1  Sperre: Bibliothek, Suche, Export, Schreiben und anonyme Zugriffe enden mit 503
//       `WIEDERANLAUF` — auch für Prüfer und Experten; Anmeldung, /health und die Verwaltung bleiben.
//   S2  Nachführung über die VORHANDENEN Wege (Papierkorb, Rollenwechsel, Kontoentfernung) und
//       Freigabe nur mit allen vier Bestätigungen; danach wirken Löschung und Entzug sofort.
//   S3  Die Freigabe trägt über einen Neustart derselben Kennung; eine neue Kennung sperrt wieder.
//   S4  Eine Kette mit Kettenbruch wird nicht freigegeben (409), die Sperre bleibt.
//   S5  Der Schalter: nicht gesetzt = Normalstart, ungültig = Abbruch.
import { describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import {
  AKTION_WIEDERANLAUF_BEGONNEN,
  AKTION_WIEDERANLAUF_FREIGEGEBEN,
  FREIGABE_BESTAETIGUNGEN,
  type WiederanlaufDeps,
  leseWiederanlauf,
  registriereWiederanlauf,
} from "../../services/app/src/wiederanlauf";
import {
  type App,
  type Bestand,
  KONTEN,
  anmelden,
  legeFiktivenBestand,
} from "../wiederherstellung-export/bestand";

const ALLE_BESTAETIGT = Object.fromEntries(FREIGABE_BESTAETIGUNGEN.map((b) => [b, true]));

function quellenVon(services: AppServices): WiederanlaufDeps["quellen"] {
  return {
    wissensobjekte: () => services.ko.list({}),
    revalidierungFaellig: () => services.lifecycle.pendingRevalidation(),
    offeneWidersprueche: () => services.conflicts.unresolved(),
    wissensobjekt: (id) => services.ko.get(id),
  };
}

async function quelle(): Promise<{ services: AppServices; b: Bestand }> {
  const services = buildServices();
  const app = buildApp(services);
  const b = await legeFiktivenBestand(app);
  await app.close();
  return { services, b };
}

async function imWiederanlauf(
  services: AppServices,
  kennung: string,
  audit: WiederanlaufDeps["audit"] = services.audit,
): Promise<App> {
  const app = buildApp(services);
  registriereWiederanlauf(app, {
    wiederanlauf: { kennung },
    audit,
    auth: services.auth,
    quellen: quellenVon(services),
  });
  await app.ready();
  return app;
}

const kennungenIn = (antwort: { json: () => unknown }) =>
  (antwort.json() as { id: string }[]).map((k) => k.id);

async function statusVon(
  app: App,
  url: string,
  headers: Record<string, string>,
  method: "GET" | "POST" | "DELETE" = "GET",
  payload?: Record<string, unknown>,
): Promise<number> {
  return (await app.inject({ method, url, headers, ...(payload ? { payload } : {}) })).statusCode;
}

describe("P09-AC05 · Wiederanlauf: Sperre, Nachführung, Freigabe", () => {
  it("S1 · bis zur Freigabe sind Bibliothek, Suche, Export und Schreiben gesperrt — die Verwaltung nicht", async () => {
    const { services, b } = await quelle();
    const app = await imWiederanlauf(services, "probe-s1");
    // Anmeldung bleibt offen, sonst könnte niemand nachführen.
    const kopf = {
      admin: await anmelden(app, KONTEN.admin.email),
      anna: await anmelden(app, KONTEN.anna.email),
      carl: await anmelden(app, KONTEN.carl.email),
      vera: await anmelden(app, KONTEN.vera.email),
    };

    for (const [wer, h] of [
      ["anna", kopf.anna],
      ["carl", kopf.carl],
      ["vera", kopf.vera],
      ["anonym", {}],
    ] as const) {
      for (const [methode, url] of [
        ["GET", "/api/kos"],
        ["GET", `/api/kos/${b.offenId}`],
        ["GET", "/api/library/export?format=json"],
        ["GET", "/api/audit/verify"],
      ] as const) {
        const res = await app.inject({ method: methode, url, headers: h });
        expect(res.statusCode, `${wer} ${methode} ${url}: ${res.body.slice(0, 200)}`).toBe(503);
        expect(res.json()).toMatchObject({ error: "WIEDERANLAUF", wiederanlauf: "probe-s1" });
        // Die Sperre verrät nichts aus dem Bestand.
        expect(res.body).not.toContain("Schichtübergabe");
      }
    }
    const schreiben = await app.inject({
      method: "PUT",
      url: `/api/kos/${b.offenId}`,
      headers: kopf.anna,
      payload: { action: "revise", changes: { statement: "Nachträglich geändert." } },
    });
    expect(schreiben.statusCode).toBe(503);

    expect((await app.inject({ url: "/health" })).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/features" })).statusCode).not.toBe(503);
    // Die Verwaltung arbeitet weiter — sie muss lesen können, was sie nachführt.
    const admin = await app.inject({ url: "/api/kos", headers: kopf.admin });
    expect(admin.statusCode).toBe(200);
    expect(kennungenIn(admin)).toContain(b.offenId);

    const lage = await app.inject({ url: "/api/admin/wiederanlauf", headers: kopf.admin });
    expect(lage.statusCode, lage.body).toBe(200);
    expect(lage.json()).toMatchObject({
      kennung: "probe-s1",
      zustand: "gesperrt",
      schritte: [...FREIGABE_BESTAETIGUNGEN],
      gestoppt: [
        { id: "wissensereignisse" },
        { id: "hintergrundpruefung" },
        { id: "lueckenerkennung" },
      ],
    });
    // Der Datenstand ist der jüngste Eintrag der Kette VOR dem Wiederanlauf.
    const begonnen = await services.audit.list({ action: AKTION_WIEDERANLAUF_BEGONNEN });
    expect(begonnen).toHaveLength(1);
    expect(typeof begonnen[0]?.payload.datenstand).toBe("string");
    const datenstand = begonnen[0]?.payload.datenstand;
    expect((lage.json() as { datenstand: string }).datenstand).toBe(datenstand);
    expect(await statusVon(app, "/api/admin/wiederanlauf", kopf.anna)).toBe(403);
    await app.close();
  });

  it("S2 · nachgeführte Löschung und Rechteentzüge wirken, bevor Suche und Bibliothek öffnen", async () => {
    const { services, b } = await quelle();
    const app = await imWiederanlauf(services, "probe-s2");
    const admin = await anmelden(app, KONTEN.admin.email);
    const anna = await anmelden(app, KONTEN.anna.email);
    const carl = await anmelden(app, KONTEN.carl.email);
    const vera = await anmelden(app, KONTEN.vera.email);

    // Ohne alle vier Bestätigungen keine Freigabe — und die Antwort nennt, was fehlt.
    const halb = await app.inject({
      method: "POST",
      url: "/api/admin/wiederanlauf/freigabe",
      headers: admin,
      payload: { integritaet: true, aussenaktionen: true },
    });
    expect(halb.statusCode).toBe(400);
    expect(halb.json()).toMatchObject({
      error: "BESTAETIGUNG_FEHLT",
      fehlend: ["rechteentzuege", "loeschmarkierungen"],
    });
    const fremd = await app.inject({
      method: "POST",
      url: "/api/admin/wiederanlauf/freigabe",
      headers: anna,
      payload: ALLE_BESTAETIGT,
    });
    expect(fremd.statusCode).toBe(403);
    expect(await services.audit.list({ action: AKTION_WIEDERANLAUF_FREIGEGEBEN })).toEqual([]);

    // NACHFÜHRUNG — die Änderungen nach dem Datenstand, über die vorhandenen Wege der Verwaltung:
    // eine Löschung (Papierkorb), ein Rechteentzug (Controller → Leser), ein entferntes Konto.
    expect(await statusVon(app, `/api/kos/${b.offenId}`, admin, "DELETE")).toBe(204);
    const herab = await app.inject({
      method: "PUT",
      url: `/api/users/${b.kennung.carl}`,
      headers: admin,
      payload: { role: "viewer" },
    });
    expect(herab.statusCode, herab.body).toBe(200);
    const weg = await app.inject({
      method: "DELETE",
      url: `/api/users/${b.kennung.vera}`,
      headers: admin,
    });
    expect(weg.statusCode, weg.body).toBe(204);

    const frei = await app.inject({
      method: "POST",
      url: "/api/admin/wiederanlauf/freigabe",
      headers: admin,
      payload: ALLE_BESTAETIGT,
    });
    expect(frei.statusCode, frei.body).toBe(200);
    expect(frei.json()).toMatchObject({ zustand: "freigegeben" });
    const eintrag = (await services.audit.list({ action: AKTION_WIEDERANLAUF_FREIGEGEBEN }))[0];
    expect(eintrag?.actor).toBe(b.kennung.admin);
    expect(eintrag?.payload).toMatchObject({
      kennung: "probe-s2",
      bestaetigt: [...FREIGABE_BESTAETIGUNGEN],
      integritaet: { linkageBreaks: 0, unresolvedDeviations: 0, uncheckedDeviations: 0 },
    });

    // GEÖFFNET — und zwar mit dem nachgeführten Stand.
    const liste = await app.inject({ url: "/api/kos", headers: anna });
    expect(liste.statusCode).toBe(200);
    expect(kennungenIn(liste)).toContain(b.nordId);
    expect(kennungenIn(liste), "gelöschtes Objekt in der Bibliothek").not.toContain(b.offenId);
    // Carl hat sein Prüfrecht verloren, Veras Sitzung ist weg.
    expect(await statusVon(app, "/api/audit/verify", carl)).toBe(403);
    expect(await statusVon(app, "/api/kos", vera)).toBe(401);
    await app.close();
  });

  it("S3 · die Freigabe gilt nach einem Neustart derselben Kennung; eine neue Kennung sperrt wieder", async () => {
    const { services } = await quelle();
    const erste = await imWiederanlauf(services, "probe-s3");
    const admin = await anmelden(erste, KONTEN.admin.email);
    const freigabe = "/api/admin/wiederanlauf/freigabe";
    expect(await statusVon(erste, freigabe, admin, "POST", ALLE_BESTAETIGT)).toBe(200);
    await erste.close();

    const neustart = await imWiederanlauf(services, "probe-s3");
    const anna = await anmelden(neustart, KONTEN.anna.email);
    expect(await statusVon(neustart, "/api/kos", anna)).toBe(200);
    // Ein zweiter Start derselben Kennung schreibt keinen zweiten Beginn.
    const begonnen = await services.audit.list({ action: AKTION_WIEDERANLAUF_BEGONNEN });
    const dieserStart = `${AKTION_WIEDERANLAUF_BEGONNEN}:probe-s3`;
    expect(begonnen.filter((e) => e.eventId === dieserStart)).toHaveLength(1);
    await neustart.close();

    const naechster = await imWiederanlauf(services, "probe-s3-b");
    const anna2 = await anmelden(naechster, KONTEN.anna.email);
    expect(await statusVon(naechster, "/api/kos", anna2)).toBe(503);
    await naechster.close();
  });

  it("S4 · trägt die Auditkette nicht, gibt es keine Freigabe", async () => {
    const { services } = await quelle();
    // Dieselbe Kette, nur ihr Prüfbericht meldet einen Kettenbruch.
    const kaputt = Object.assign(Object.create(services.audit), {
      verifyReport: async () => ({
        ok: false,
        count: 1,
        linkageBreaks: 1,
        payloadDeviations: 0,
        serialisationDeviations: 0,
        unresolvedDeviations: 0,
        uncheckedDeviations: 0,
      }),
    }) as WiederanlaufDeps["audit"];
    const app = await imWiederanlauf(services, "probe-s4", kaputt);
    const admin = await anmelden(app, KONTEN.admin.email);
    const anna = await anmelden(app, KONTEN.anna.email);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/wiederanlauf/freigabe",
      headers: admin,
      payload: ALLE_BESTAETIGT,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: "INTEGRITAET", integritaet: { linkageBreaks: 1 } });
    expect((await app.inject({ url: "/api/kos", headers: anna })).statusCode).toBe(503);
    expect(await services.audit.list({ action: AKTION_WIEDERANLAUF_FREIGEGEBEN })).toEqual([]);
    await app.close();
  });

  it("S5 · der Schalter: nicht gesetzt = Normalstart, ungültig = Abbruch", () => {
    expect(leseWiederanlauf({})).toBeUndefined();
    expect(leseWiederanlauf({ KLARWERK_WIEDERANLAUF: "  " })).toBeUndefined();
    expect(leseWiederanlauf({ KLARWERK_WIEDERANLAUF: "restore-2026-10-11" })).toEqual({
      kennung: "restore-2026-10-11",
    });
    expect(() => leseWiederanlauf({ KLARWERK_WIEDERANLAUF: "mit leerzeichen" })).toThrow(
      /KLARWERK_WIEDERANLAUF/,
    );
    expect(() => leseWiederanlauf({ KLARWERK_WIEDERANLAUF: "x".repeat(65) })).toThrow();
  });
});
