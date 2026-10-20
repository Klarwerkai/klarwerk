// ================================================================================================
// AW-16 · AUFTRAGSVERKNÜPFUNG ÜBER DIE GELIEFERTEN PERSÖNLICHEN AUFGABEN (Ben, Nacharbeit 7/8).
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp`, Speicherablage) mit echter Anmeldung und den ECHTEN
// persönlichen Aufgaben aus produkt:20261008:klara-aufgaben (main 25f2ea02, integriert in
// Nacharbeit 8): Aufgaben entstehen über deren eigene Türen (`POST /api/me/klara/notizen`, dann
// `POST /api/me/klara/aufgaben` aus der Notiz), werden über `PUT`/`DELETE` derselben Türen geändert
// bzw. gelöscht, und der Kalender liest sie über den berechtigten Leseweg `KlaraAufgabeDienst.hole`
// (`aufgabenNachweisAus`, verdrahtet in build-app.ts). Kein Stellvertreter, keine Simulation.
// Alle Namen und Inhalte sind erfundene Testdaten dieses Falls.
//
// Ohne Ausführungsdienst (Erinnerungssteuerung, eigener Auftrag, nicht gebaut) bleiben Lauf,
// Serie, Ergebnis und jede Ausführungsaktion gesperrt — auch mit angeschlossenen Aufgaben.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { aufgabenNachweisAus } from "../../services/app/src/eigener-kalender";
import type { SessionUser } from "../../services/app/src/http";
import type { TeamFassung } from "../../services/app/src/teams";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
const TEAM_ID = "team-instandhaltung-nord";
/** Derselbe Ortsbezug wie in den Prüfungen der gelieferten Aufgaben (aufgabe-am-server). */
const BEZUG = {
  pfad: "/wissen/ko-presse-4",
  seitenName: "Lesen",
  objekt: "Ölwechsel Presse 4",
  koId: "ko-presse-4",
  fassung: 3,
  absatz: 2,
};

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

function team(mitglieder: string[], verantwortlich: string): TeamFassung {
  return {
    id: TEAM_ID,
    version: 1,
    name: "Instandhaltung Nord",
    zweck: "Fiktives Prüfteam für die Aufgabenverknüpfung.",
    verantwortlich,
    mitglieder,
    archiviert: false,
    vorgang: "angelegt",
    angelegtVon: "fiktiv",
    angelegtAm: "2026-10-01T08:00:00.000Z",
    geaendertVon: "fiktiv",
    geaendertAm: "2026-10-01T08:00:00.000Z",
  };
}

let vorgaenge = 0;
function vorgang(): string {
  vorgaenge += 1;
  return `kalender-vorgang-${String(vorgaenge).padStart(4, "0")}`;
}

/** Eine ECHTE persönliche Aufgabe über die gelieferten Türen: erst die Notiz, dann die Aufgabe. */
async function aufgabe(
  app: App,
  kopf: Kopf,
  titel: string,
): Promise<{ id: string; fassung: number }> {
  const notiz = await app.inject({
    method: "POST",
    url: "/api/me/klara/notizen",
    headers: kopf,
    payload: {
      vorgang: vorgang(),
      weg: "geschrieben",
      inhalt: `${titel} (fiktive Notiz)`,
      titel,
      objektbezug: BEZUG,
    },
  });
  expect(notiz.statusCode, notiz.body).toBe(201);
  const res = await app.inject({
    method: "POST",
    url: "/api/me/klara/aufgaben",
    headers: kopf,
    payload: {
      vorgang: vorgang(),
      weg: "notiz",
      quelle: { notizId: notiz.json().notiz.id },
      titel,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  const a = res.json().aufgabe;
  return { id: a.id as string, fassung: a.fassung as number };
}

async function buehne() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "admin@aufgaben.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@aufgaben.test");
  for (const [name, email] of [
    ["Erik Experte", "erik@aufgaben.test"],
    ["Lea Leitung", "lea@aufgaben.test"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role: "experte" },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    erik: await anmelden(app, "erik@aufgaben.test"),
    lea: await anmelden(app, "lea@aufgaben.test"),
  };
  return { app, k };
}

async function mitTeam() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "admin@aufgaben.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@aufgaben.test");
  const ids: Record<string, string> = {};
  for (const [name, email, kurz] of [
    ["Erik Experte", "erik@aufgaben.test", "erik"],
    ["Lea Leitung", "lea@aufgaben.test", "lea"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role: "experte" },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
    ids[kurz] = res.json().id as string;
  }
  const erikId = ids.erik as string;
  const leaId = ids.lea as string;
  await services.teams.lege(team([erikId, leaId], erikId));
  const k = {
    erik: await anmelden(app, "erik@aufgaben.test"),
    lea: await anmelden(app, "lea@aufgaben.test"),
  };
  return { app, k, ids: { erik: erikId, lea: leaId } };
}

const TERMIN = {
  art: "aufgabe",
  titel: "Prüfbericht Pumpe P-7",
  notiz: "Fiktiver Kalendereintrag.",
  ganztaegig: false,
  beginn: "2026-10-14T13:00:00+02:00",
  ende: "2026-10-14T14:00:00+02:00",
  zeitzone: "Europe/Berlin",
};

function lege(app: App, kopf: Kopf, eingabe: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/api/me/kalender/eintraege",
    headers: kopf,
    payload: eingabe,
  });
}

async function lies(app: App, kopf: Kopf, id: string) {
  const res = await app.inject({
    method: "GET",
    url: `/api/me/kalender/eintraege/${id}`,
    headers: kopf,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().eintrag;
}

async function ansicht(app: App, kopf: Kopf, bereich = "persoenlich") {
  const res = await app.inject({
    method: "GET",
    url: `/api/me/kalender?bereich=${bereich}`,
    headers: kopf,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

describe("AW-16 · Auftragsverknüpfung über die gelieferten persönlichen Aufgaben", () => {
  it("K3 · eine eigene Aufgabe wird verknüpft, nach Neuladen mit heutigen Rechten aufgelöst; Eintrag, Auftrag und Ergebnis bleiben getrennt", async () => {
    const { app, k } = await buehne();
    const vorher = await ansicht(app, k.erik);
    expect(vorher).toMatchObject({ aufgabenAngebunden: true, ausfuehrungAngebunden: false });
    const pumpe = await aufgabe(app, k.erik, "Prüfbericht Pumpe P-7 schreiben");

    const res = await lege(app, k.erik, { ...TERMIN, auftrag: { taskId: pumpe.id } });
    expect(res.statusCode, res.body).toBe(201);
    const e = res.json().eintrag;
    expect(e).toMatchObject({
      titel: "Prüfbericht Pumpe P-7",
      auftrag: { taskId: pumpe.id, titel: "Prüfbericht Pumpe P-7 schreiben", aufgeloest: true },
      lauf: null,
      serie: null,
      // Eine Aufgabe ist kein Ergebnis — ohne Ausführungsnachweis steht hier nichts.
      ergebnis: null,
    });

    // „Neuladen": eine NEUE Sitzung liest denselben Eintrag und löst den Auftrag erneut auf.
    const neueSitzung = await anmelden(app, "erik@aufgaben.test");
    const wieder = (await ansicht(app, neueSitzung)).eintraege;
    expect(wieder).toHaveLength(1);
    expect(wieder[0]).toMatchObject({
      id: e.id,
      auftrag: { taskId: pumpe.id, titel: "Prüfbericht Pumpe P-7 schreiben", aufgeloest: true },
    });
    // Der Titel der Aufgabe steht nicht im Kalender: ändert die Aufgabe ihn an IHRER Tür, zeigt
    // der Kalender den neuen.
    const umbenannt = await app.inject({
      method: "PUT",
      url: `/api/me/klara/aufgaben/${pumpe.id}`,
      headers: k.erik,
      payload: { fassung: pumpe.fassung, titel: "Prüfbericht Pumpe P-7 abschließen" },
    });
    expect(umbenannt.statusCode, umbenannt.body).toBe(200);
    const nachUmbenennen = await lies(app, k.erik, e.id);
    expect(nachUmbenennen.auftrag.titel).toBe("Prüfbericht Pumpe P-7 abschließen");

    // NEGATIV · der Titel lässt sich nicht behaupten, ein Ergebnis nicht eintragen.
    for (const behauptung of [
      { auftrag: { taskId: pumpe.id, titel: "Selbst ausgedacht" } },
      { ergebnis: { art: "lauf_abgeschlossen", am: "2026-10-14T14:00:00Z" } },
    ]) {
      const r = await lege(app, k.erik, { ...TERMIN, ...behauptung });
      expect(r.statusCode, JSON.stringify(behauptung)).toBe(400);
    }
  });

  it("K3/K7 · fremde und unbekannte Aufgaben fallen durch; eine entzogene Aufgabe wird nicht mehr aufgelöst", async () => {
    const { app, k } = await buehne();
    const pumpe = await aufgabe(app, k.erik, "Prüfbericht Pumpe P-7 schreiben");
    const privat = await aufgabe(app, k.lea, "Arzttermin vorbereiten");
    // NEGATIV · Leas Aufgabe ist für Erik dasselbe wie eine erfundene: 404, nichts gespeichert.
    for (const taskId of [privat.id, "aufgabe-gibt-es-nicht"]) {
      const r = await lege(app, k.erik, { ...TERMIN, auftrag: { taskId } });
      expect(r.statusCode, taskId).toBe(404);
      expect(r.json().grund).toBe("verweis_unbekannt");
      expect(r.body).not.toContain("Arzttermin");
    }
    expect((await ansicht(app, k.erik)).eintraege).toEqual([]);

    // Nachträglich verknüpfen geht genauso nur auf eine heute sichtbare Aufgabe.
    const e = (await lege(app, k.erik, TERMIN)).json().eintrag;
    const fremd = await app.inject({
      method: "PUT",
      url: `/api/me/kalender/eintraege/${e.id}`,
      headers: k.erik,
      payload: { fassung: e.fassung, auftrag: { taskId: privat.id } },
    });
    expect(fremd.statusCode).toBe(404);
    const eigen = await app.inject({
      method: "PUT",
      url: `/api/me/kalender/eintraege/${e.id}`,
      headers: k.erik,
      payload: { fassung: e.fassung, auftrag: { taskId: pumpe.id } },
    });
    expect(eigen.statusCode, eigen.body).toBe(200);

    // ENTZUG: Erik löscht die Aufgabe an IHRER Tür. Der Kalendereintrag bleibt, der Auftrag ist
    // ausdrücklich nicht aufgelöst und ohne Titel.
    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/me/klara/aufgaben/${pumpe.id}`,
      headers: k.erik,
    });
    expect(geloescht.statusCode, geloescht.body).toBe(200);
    const nachEntzug = await lies(app, await anmelden(app, "erik@aufgaben.test"), e.id);
    expect(nachEntzug).toMatchObject({
      id: e.id,
      titel: "Prüfbericht Pumpe P-7",
      auftrag: { taskId: pumpe.id, titel: null, aufgeloest: false },
      ergebnis: null,
    });
    expect(JSON.stringify(nachEntzug)).not.toContain("Prüfbericht Pumpe P-7 schreiben");
    // Eine ERNEUTE Verknüpfung auf die entzogene Kennung wird abgewiesen.
    const erneut = await lege(app, k.erik, { ...TERMIN, auftrag: { taskId: pumpe.id } });
    expect(erneut.statusCode).toBe(404);
  });

  it("K5 · eine persönliche Aufgabe kommt nicht in den Teamkalender; persönliche Verknüpfungen bleiben privat", async () => {
    const { app, k, ids } = await mitTeam();
    const pumpe = await aufgabe(app, k.erik, "Prüfbericht Pumpe P-7 schreiben");
    const privat = await lege(app, k.erik, { ...TERMIN, auftrag: { taskId: pumpe.id } });
    expect(privat.statusCode, privat.body).toBe(201);

    // NEGATIV · dieselbe persönliche Aufgabe im Teamkalender: abgewiesen, nichts gespeichert.
    const imTeam = await lege(app, k.erik, {
      ...TERMIN,
      bereich: "team",
      teamId: TEAM_ID,
      verantwortlich: ids.erik,
      auftrag: { taskId: pumpe.id },
    });
    expect(imTeam.statusCode).toBe(409);
    expect(imTeam.json().grund).toBe("aufgabe_persoenlich");
    const teamEintrag = (
      await lege(app, k.erik, {
        ...TERMIN,
        bereich: "team",
        teamId: TEAM_ID,
        verantwortlich: ids.erik,
      })
    ).json().eintrag;
    const nachtraeglich = await app.inject({
      method: "PUT",
      url: `/api/me/kalender/eintraege/${teamEintrag.id}`,
      headers: k.erik,
      payload: { fassung: teamEintrag.fassung, auftrag: { taskId: pumpe.id } },
    });
    expect(nachtraeglich.statusCode).toBe(409);
    expect(nachtraeglich.json().grund).toBe("aufgabe_persoenlich");

    // Lea und Erik sehen im Teamkalender nur den Teameintrag ohne Auftrag — weder Eriks privaten
    // Eintrag noch Kennung oder Titel seiner Aufgabe.
    for (const kopf of [k.lea, k.erik]) {
      const sicht = await ansicht(app, kopf, "team");
      expect(sicht.eintraege.map((x: { id: string }) => x.id)).toEqual([teamEintrag.id]);
      expect(sicht.eintraege[0].auftrag).toBeNull();
      const text = JSON.stringify(sicht);
      expect(text).not.toContain(pumpe.id);
      expect(text).not.toContain("Prüfbericht Pumpe P-7 schreiben");
    }
    const fremd = await app.inject({
      method: "GET",
      url: `/api/me/kalender/eintraege/${privat.json().eintrag.id}`,
      headers: k.lea,
    });
    expect(fremd.statusCode).toBe(404);
  });

  it("K3/K6 · ohne Ausführungsdienst bleiben Lauf, Serie, Ergebnis und Ausführungsaktionen gesperrt", async () => {
    const { app, k } = await buehne();
    const pumpe = await aufgabe(app, k.erik, "Prüfbericht Pumpe P-7 schreiben");
    for (const verweise of [
      { auftrag: { taskId: pumpe.id }, lauf: { runId: "lauf-1" } },
      { serie: { seriesId: "serie-wartung" } },
      { auftrag: { taskId: pumpe.id }, serie: { seriesId: "serie-wartung" } },
    ]) {
      const r = await lege(app, k.erik, { ...TERMIN, ...verweise });
      expect(r.statusCode, JSON.stringify(verweise)).toBe(409);
      expect(r.json().grund).toBe("ausfuehrung_nicht_angebunden");
    }
    const angelegt = await lege(app, k.erik, { ...TERMIN, auftrag: { taskId: pumpe.id } });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const e = angelegt.json().eintrag;
    for (const aktion of ["lauf_absagen", "arbeit_abbrechen", "serie_pausieren"]) {
      const f = await app.inject({
        method: "POST",
        url: `/api/me/kalender/eintraege/${e.id}/folgen`,
        headers: k.erik,
        payload: { aktion },
      });
      expect(f.statusCode, f.body).toBe(200);
      expect(f.json().folgen).toMatchObject({
        moeglich: false,
        hinderung: "ausfuehrung_nicht_angebunden",
      });
      const h = await app.inject({
        method: "POST",
        url: `/api/me/kalender/eintraege/${e.id}/aktionen`,
        headers: k.erik,
        payload: { aktion, bestaetigt: true },
      });
      expect(h.statusCode, aktion).toBe(409);
    }
    expect(await lies(app, k.erik, e.id)).toMatchObject({
      lauf: null,
      serie: null,
      ergebnis: null,
    });
  });

  it("Anschluss · nur 404 heisst „nicht sichtbar“; jeder andere Fehler des Lesewegs wird nicht verschluckt", async () => {
    const user = { id: "konto-1" } as SessionUser;
    const kaputt = aufgabenNachweisAus({
      hole: async () => {
        throw Object.assign(new Error("Ablage nicht erreichbar"), { status: 500 });
      },
    });
    await expect(kaputt.aufgabe(user, "aufgabe-x")).rejects.toThrow("Ablage nicht erreichbar");
    const fehlt = aufgabenNachweisAus({
      hole: async () => {
        throw Object.assign(new Error("Aufgabe nicht gefunden."), { status: 404 });
      },
    });
    expect(await fehlt.aufgabe(user, "aufgabe-x")).toBeNull();
  });
});
