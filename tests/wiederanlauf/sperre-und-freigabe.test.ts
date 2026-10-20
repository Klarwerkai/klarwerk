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
  AKTION_WIEDERANLAUF_SICHERUNGSSTAND,
  FREIGABE_BESTAETIGUNGEN,
  type WiederanlaufDeps,
  leseWiederanlauf,
  registriereWiederanlauf,
  sicherungsstandAus,
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

/** Ein fester, vergangener Sicherungsstand für die Fälle, die nicht ihn selbst prüfen. */
const SICHERUNG = "2026-10-11T03:15:00.000Z";

async function imWiederanlauf(
  services: AppServices,
  kennung: string,
  optionen: { audit?: WiederanlaufDeps["audit"]; sicherungsstand?: string | undefined } = {
    sicherungsstand: SICHERUNG,
  },
): Promise<App> {
  const app = buildApp(services);
  registriereWiederanlauf(app, {
    wiederanlauf: { kennung, sicherungsstand: optionen.sicherungsstand },
    audit: optionen.audit ?? services.audit,
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
        { id: "klara-erinnerungen" },
      ],
    });
    // Die Nachführungsgrenze ist der angegebene Sicherungsstand, festgehalten im Beginn-Eintrag.
    const begonnen = await services.audit.list({ action: AKTION_WIEDERANLAUF_BEGONNEN });
    expect(begonnen).toHaveLength(1);
    expect(begonnen[0]?.payload.sicherungsstand).toBe(SICHERUNG);
    expect(lage.json()).toMatchObject({ nachfuehrungsgrenze: { sicherungsstand: SICHERUNG } });
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
    const app = await imWiederanlauf(services, "probe-s4", {
      audit: kaputt,
      sicherungsstand: SICHERUNG,
    });
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
    // Der Sicherungsstand: Dateiname von backup.sh (auch mit Pfad/Folgenummer) oder UTC-Zeit.
    const mit = (sicherung: string) =>
      leseWiederanlauf({ KLARWERK_WIEDERANLAUF: "r", KLARWERK_WIEDERANLAUF_SICHERUNG: sicherung });
    expect(mit("/data/backups/klarwerk-20261011T031500Z_02.dump")?.sicherungsstand).toBe(SICHERUNG);
    expect(mit("klarwerk-20261011T031500Z.dump")?.sicherungsstand).toBe(SICHERUNG);
    expect(mit("2026-10-11T03:15:00Z")?.sicherungsstand).toBe(SICHERUNG);
    expect(leseWiederanlauf({ KLARWERK_WIEDERANLAUF: "r" })?.sicherungsstand).toBeUndefined();
    const ungueltig = ["gestern", "klarwerk-2026.dump", "2026-10-11 03:15", "2026-13-40T99:00Z"];
    for (const falsch of ungueltig) {
      expect(() => mit(falsch), falsch).toThrow(/KLARWERK_WIEDERANLAUF_SICHERUNG/);
    }
    expect(sicherungsstandAus("klarwerk-20261011T031500Z.dump")).toBe(SICHERUNG);
  });

  // ==============================================================================================
  // Ben, Nacharbeit 2 (P09-AC05): die Nachführungsgrenze ist der Sicherungsstand, nie ein späterer
  // Auditzeitpunkt — Ablauf Sicherung → Löschung/Entzug → Drill-Anmeldung → Wiederanlauf.
  // ==============================================================================================
  it("S6 · Grenze = Sicherungsstand, auch wenn Löschung, Entzug und Drill-Anmeldung danach in der Kette stehen", async () => {
    const { services, b } = await quelle();
    const sicherung = new Date().toISOString(); // hier wird gesichert
    await new Promise((r) => setTimeout(r, 10));
    // Nach der Sicherung: Löschung und Rechteentzug in der Quelle …
    const quellApp = buildApp(services);
    const admin = await anmelden(quellApp, KONTEN.admin.email);
    expect(await statusVon(quellApp, `/api/kos/${b.offenId}`, admin, "DELETE")).toBe(204);
    const entzug = await quellApp.inject({
      method: "PUT",
      url: `/api/users/${b.kennung.carl}`,
      headers: admin,
      payload: { role: "viewer" },
    });
    expect(entzug.statusCode, entzug.body).toBe(200);
    // … dann die Anmeldung des Restore-Drills — der jüngste Eintrag vor dem Wiederanlauf.
    await anmelden(quellApp, KONTEN.admin.email);
    await services.audit.record({
      actor: b.kennung.admin,
      action: "probe.drill-anmeldung",
      target: "drill",
    });
    await quellApp.close();
    const juengster = (await services.audit.page({ limit: 1 })).entries[0]?.at ?? "";
    const loeschung = (await services.audit.list({ action: "ko.deleted" })).at(-1)?.at ?? "";
    expect(loeschung > sicherung, "Löschung liegt nach der Sicherung").toBe(true);
    expect(juengster > loeschung, "Drill-Anmeldung liegt nach der Löschung").toBe(true);

    const app = await imWiederanlauf(services, "probe-s6", { sicherungsstand: sicherung });
    const verwaltung = await anmelden(app, KONTEN.admin.email);
    const lage = await app.inject({ url: "/api/admin/wiederanlauf", headers: verwaltung });
    const auskunft = lage.json() as { nachfuehrungsgrenze: { sicherungsstand: string } };
    const grenze = auskunft.nachfuehrungsgrenze.sicherungsstand;
    // Die Grenze ist die Sicherung — Löschung und Entzug liegen danach und gehören zur Nachführung.
    expect(grenze).toBe(sicherung);
    expect(grenze < loeschung).toBe(true);
    expect(grenze).not.toBe(juengster);
    expect((lage.json() as { naechsterSchritt: string }).naechsterSchritt).toContain(sicherung);
    await app.close();

    // DAUERHAFT: ein Neustart ohne Angabe behält die festgehaltene Grenze.
    const neustart = await imWiederanlauf(services, "probe-s6", { sicherungsstand: undefined });
    const verwaltung2 = await anmelden(neustart, KONTEN.admin.email);
    const nochmal = await neustart.inject({ url: "/api/admin/wiederanlauf", headers: verwaltung2 });
    expect(nochmal.json()).toMatchObject({ nachfuehrungsgrenze: { sicherungsstand: sicherung } });
    const frei = await statusVon(
      neustart,
      "/api/admin/wiederanlauf/freigabe",
      verwaltung2,
      "POST",
      ALLE_BESTAETIGT,
    );
    expect(frei).toBe(200);
    const eintrag = (await services.audit.list({ action: AKTION_WIEDERANLAUF_FREIGEGEBEN }))[0];
    expect(eintrag?.payload.nachfuehrungsgrenze).toBe(sicherung);
    await neustart.close();
  });

  it("S7 · unbekannter Sicherungsstand: kein Ersatz aus der Kette, keine Freigabe — bis er angegeben ist", async () => {
    const { services } = await quelle();
    const app = await imWiederanlauf(services, "probe-s7", { sicherungsstand: undefined });
    const admin = await anmelden(app, KONTEN.admin.email);
    const anna = await anmelden(app, KONTEN.anna.email);
    const lage = await app.inject({ url: "/api/admin/wiederanlauf", headers: admin });
    // Die Kette hat Einträge — trotzdem keine Auditzeit als Grenze.
    expect(await services.audit.kopfSeq()).toBeGreaterThan(0);
    expect(lage.json()).toMatchObject({ nachfuehrungsgrenze: { sicherungsstand: null } });
    const freigabe = await app.inject({
      method: "POST",
      url: "/api/admin/wiederanlauf/freigabe",
      headers: admin,
      payload: ALLE_BESTAETIGT,
    });
    expect(freigabe.statusCode).toBe(409);
    expect(freigabe.json()).toMatchObject({ error: "SICHERUNGSSTAND_UNBEKANNT" });
    expect(await statusVon(app, "/api/kos", anna)).toBe(503);
    expect(await services.audit.list({ action: AKTION_WIEDERANLAUF_FREIGEGEBEN })).toEqual([]);
    await app.close();

    // Neustart derselben Kennung MIT Angabe: der Stand wird nachgetragen, dann ist Freigabe möglich.
    const neustart = await imWiederanlauf(services, "probe-s7", { sicherungsstand: SICHERUNG });
    const admin2 = await anmelden(neustart, KONTEN.admin.email);
    const freigabe2 = "/api/admin/wiederanlauf/freigabe";
    expect(await statusVon(neustart, freigabe2, admin2, "POST", ALLE_BESTAETIGT)).toBe(200);
    const nachtrag = await services.audit.list({ action: AKTION_WIEDERANLAUF_SICHERUNGSSTAND });
    expect(nachtrag.map((e) => e.payload.sicherungsstand)).toEqual([SICHERUNG]);
    await neustart.close();
  });
});
