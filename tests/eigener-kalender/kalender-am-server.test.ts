// ================================================================================================
// AW-16 · DER EIGENE KALENDER AM ECHTEN SERVER (produkt:20261010:klara-eigener-kalender).
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp`, Speicherablage) mit echter Anmeldung. Die Vorrichtung legt
// ihre Konten selbst an (erstes Konto = Admin, danach `POST /api/users`) und ein Team direkt in der
// Teamablage. Alle Namen, Termine und Inhalte sind erfundene Testdaten dieses Falls.
//
//   Erik (experte) — Teamzuständiger von „Instandhaltung Süd", führt seinen persönlichen Kalender
//   Lea  (experte) — Teammitglied, später aus dem Team genommen
//   Mia  (viewer)  — Teammitglied ohne Teamzuständigkeit
//   Fritz(experte) — kein Mitglied: der Unberechtigte
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · AW16-K01 anlegen, öffnen, ändern, löschen ohne externes Konto; neue Sitzung = derselbe Eintrag
//   K2 · AW16-K02 Zeitzone, ganztägige Frist, Herkunft, Status; gleicher Eintrag, gleiche Kennung
//   K3 · AW16-K03 Eintrag, Auftrag, Ergebnis getrennt; Ergebnis NUR aus dem Ausführungsnachweis
//   K4 · AW16-K04 Sichtwahl eigen/vorhanden/beide; Termine des vorhandenen Kalenders; intern bleibt
//   K5 · AW16-K05 persönlich nie im Teamkalender; unzugeordnet sichtbar und ohne Ausführungsauftrag
//   K6 · AW16-K06 verschiedene Aktionen, Folgen vorher, Wirkung nur bestätigt beim Ausführungsdienst
//   K7 · AW16-K07 Quellrechteentzug; Zugriff und Serienkontrolle mit heutigen Rechten, auch je Eintrag
//   K8 · AW16-K08 ein Termin ohne Auftrag löst nichts aus (eigene Datei: kalender-ohne-ausfuehrung)
//
// AUSFÜHRUNGSDIENST UND VORHANDENER KALENDER SIND HIER SIMULIERT (`simulierte-zugaenge.ts`): im
// Produkt gibt es beide noch nicht (eigene Aufträge). Belegt wird, wie der Kalender den Zugang
// benutzt — nicht eine echte Zustellung, Absage oder ein echter externer Kalender.
//
// Neustart (Pool und App neu) belegt `kalender-pg.integration.test.ts`; Browserbedienung
// `tests-smoke/eigener-kalender-browser.spec.ts`.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type {
  AusfuehrungsNachweis,
  VorhandenerKalender,
} from "../../services/app/src/eigener-kalender";
import type { TeamFassung } from "../../services/app/src/teams";
import {
  SimulierterAusfuehrungsdienst,
  SimulierterVorhandenerKalender,
} from "./simulierte-zugaenge";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
const TEAM_ID = "team-instandhaltung-sued";

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

function team(version: number, mitglieder: string[], verantwortlich: string): TeamFassung {
  return {
    id: TEAM_ID,
    version,
    name: "Instandhaltung Süd",
    zweck: "Fiktives Prüfteam für den eigenen Kalender.",
    verantwortlich,
    mitglieder,
    archiviert: false,
    vorgang: version === 1 ? "angelegt" : "geaendert",
    angelegtVon: "fiktiv",
    angelegtAm: "2026-10-01T08:00:00.000Z",
    geaendertVon: "fiktiv",
    geaendertAm: "2026-10-01T08:00:00.000Z",
  };
}

async function buehne(
  zugang: { ausfuehrung?: AusfuehrungsNachweis | null; vorhanden?: VorhandenerKalender } = {},
) {
  const services = buildServices();
  if (zugang.ausfuehrung !== undefined) {
    services.kalenderAusfuehrung = zugang.ausfuehrung;
  }
  if (zugang.vorhanden) {
    services.vorhandenerKalender = zugang.vorhanden;
  }
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "admin@kalender.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@kalender.test");
  const konten = [
    ["Erik Experte", "erik@kalender.test", "experte"],
    ["Lea Leitung", "lea@kalender.test", "experte"],
    ["Mia Mitglied", "mia@kalender.test", "viewer"],
    ["Fritz Fremd", "fritz@kalender.test", "experte"],
  ] as const;
  for (const [name, email, role] of konten) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    admin,
    erik: await anmelden(app, "erik@kalender.test"),
    lea: await anmelden(app, "lea@kalender.test"),
    mia: await anmelden(app, "mia@kalender.test"),
    fritz: await anmelden(app, "fritz@kalender.test"),
  };
  const id = async (kopf: Kopf): Promise<string> => {
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: kopf });
    expect(me.statusCode, me.body).toBe(200);
    return me.json().id as string;
  };
  const ids = { erik: await id(k.erik), lea: await id(k.lea), mia: await id(k.mia) };
  await services.teams.lege(team(1, [ids.erik, ids.lea, ids.mia], ids.erik));
  return { services, app, k, ids };
}

const TERMIN = {
  art: "termin",
  titel: "Abstimmung Prüfplan Pumpe P-7",
  notiz: "Fiktiver Termin.",
  ganztaegig: false,
  beginn: "2026-10-12T09:00:00+02:00",
  ende: "2026-10-12T10:00:00+02:00",
  zeitzone: "Europe/Berlin",
};

const FRIST = {
  art: "frist",
  titel: "Zertifikat Z-8 läuft ab",
  notiz: null,
  ganztaegig: true,
  beginn: "2026-11-30",
  ende: null,
  zeitzone: "Europe/Berlin",
  fristId: "frist-z8",
};

function lege(app: App, kopf: Kopf, eingabe: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/api/me/kalender/eintraege",
    headers: kopf,
    payload: eingabe,
  });
}

function aendere(app: App, kopf: Kopf, id: string, eingabe: Record<string, unknown>) {
  return app.inject({
    method: "PUT",
    url: `/api/me/kalender/eintraege/${id}`,
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

async function folgen(app: App, kopf: Kopf, id: string, aktion: string) {
  const res = await app.inject({
    method: "POST",
    url: `/api/me/kalender/eintraege/${id}/folgen`,
    headers: kopf,
    payload: { aktion },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().folgen;
}

function handeln(app: App, kopf: Kopf, id: string, aktion: string, bestaetigt: unknown) {
  return app.inject({
    method: "POST",
    url: `/api/me/kalender/eintraege/${id}/aktionen`,
    headers: kopf,
    payload: { aktion, bestaetigt },
  });
}

async function ansicht(app: App, kopf: Kopf, bereich = "persoenlich", ausgeblendete = false) {
  const res = await app.inject({
    method: "GET",
    url: `/api/me/kalender?bereich=${bereich}${ausgeblendete ? "&ausgeblendete=1" : ""}`,
    headers: kopf,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

describe("AW-16 · eigener Kalender am echten Server", () => {
  it("K1 · anlegen, öffnen, ändern, löschen — ohne externes Konto, neue Sitzung sieht denselben Eintrag", async () => {
    const { app, k } = await buehne();
    const leer = await ansicht(app, k.erik);
    expect(leer.eintraege).toEqual([]);
    expect(leer.vorhandenerKalender).toEqual({ verbunden: false, termine: [] });
    expect(leer.ausfuehrungAngebunden).toBe(true);

    const angelegt = await lege(app, k.erik, TERMIN);
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const e = angelegt.json().eintrag;
    expect(e).toMatchObject({ bereich: "persoenlich", titel: TERMIN.titel, fassung: 1 });
    expect(await lies(app, k.erik, e.id)).toEqual(e);

    const geaendert = await aendere(app, k.erik, e.id, {
      fassung: 1,
      titel: "Abstimmung Prüfplan Pumpe P-7 (verschoben)",
    });
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    expect(geaendert.json().eintrag).toMatchObject({ id: e.id, fassung: 2 });
    // Ein veralteter Schreiber überschreibt nicht still.
    const veraltet = await aendere(app, k.erik, e.id, { fassung: 1, titel: "Zweiter Tab" });
    expect(veraltet.statusCode).toBe(409);

    // „Neuladen": eine NEUE Sitzung desselben Kontos liest denselben Eintrag mit derselben Kennung.
    const neueSitzung = await anmelden(app, "erik@kalender.test");
    const wieder = await ansicht(app, neueSitzung);
    expect(wieder.eintraege.map((x: { id: string; titel: string }) => [x.id, x.titel])).toEqual([
      [e.id, "Abstimmung Prüfplan Pumpe P-7 (verschoben)"],
    ]);

    const weg = await app.inject({
      method: "DELETE",
      url: `/api/me/kalender/eintraege/${e.id}`,
      headers: k.erik,
    });
    expect(weg.statusCode, weg.body).toBe(200);
    const danach = await app.inject({
      method: "GET",
      url: `/api/me/kalender/eintraege/${e.id}`,
      headers: k.erik,
    });
    expect(danach.statusCode).toBe(404);
    expect((await ansicht(app, k.erik)).eintraege).toEqual([]);
  });

  it("K2 · lokale Zeitzone, ganztägige Frist, Herkunft und Status; gleiche Kennung überall", async () => {
    const { app, k } = await buehne();
    const termin = (await lege(app, k.erik, TERMIN)).json().eintrag;
    // Der Zeitpunkt wird als UTC gespeichert, die Zone der Anlage bleibt erhalten.
    expect(termin).toMatchObject({
      ganztaegig: false,
      beginn: "2026-10-12T07:00:00.000Z",
      ende: "2026-10-12T08:00:00.000Z",
      zeitzone: "Europe/Berlin",
      herkunft: { art: "eigen", koId: null },
      status: "offen",
    });
    // Die ganztägige Frist bleibt ein Datum — keine Zone schiebt sie auf einen anderen Tag.
    const fristRes = await lege(app, k.erik, { ...FRIST, zeitzone: "America/New_York" });
    const frist = fristRes.json().eintrag;
    expect(frist).toMatchObject({ ganztaegig: true, beginn: "2026-11-30", ende: null });

    const liste = (await ansicht(app, k.erik)).eintraege as { id: string }[];
    expect(liste.map((x) => x.id)).toEqual([termin.id, frist.id]);
    for (const x of liste) {
      expect(await lies(app, k.erik, x.id)).toEqual(x);
    }

    // Unklare Zeitangaben werden abgewiesen statt geraten.
    for (const falsch of [
      { ...TERMIN, beginn: "2026-10-12T09:00" },
      { ...TERMIN, zeitzone: "Mitteleuropa/Irgendwo" },
      { ...TERMIN, ende: "2026-10-12T08:00:00+02:00" },
      { ...FRIST, beginn: "2026-02-30" },
    ]) {
      const res = await lege(app, k.erik, falsch);
      expect(res.statusCode, JSON.stringify(falsch)).toBe(400);
    }
  });

  it("K3 · Auftrag und Ergebnis kommen aus dem Ausführungsnachweis; „Erinnerung zugestellt“ lässt die Frist offen", async () => {
    const dienst = new SimulierterAusfuehrungsdienst();
    const { app, k, ids } = await buehne({ ausfuehrung: dienst });
    dienst.auftragAnlegen("auftrag-z8", "Zertifikat Z-8 verlängern", [ids.erik, ids.mia]);
    dienst.laufSetzen("auftrag-z8", "lauf-z8-30t", "abgeschlossen", {
      art: "erinnerung_zugestellt",
      am: "2026-10-31T08:00:00.000Z",
    });

    const res = await lege(app, k.erik, {
      ...FRIST,
      auftrag: { taskId: "auftrag-z8" },
      lauf: { runId: "lauf-z8-30t" },
    });
    expect(res.statusCode, res.body).toBe(201);
    const e = res.json().eintrag;
    // Titel, Stand und Ergebnis stammen aus dem Nachweis — der Kalender hat sie nicht gespeichert.
    expect(e.auftrag).toEqual({
      taskId: "auftrag-z8",
      titel: "Zertifikat Z-8 verlängern",
      aufgeloest: true,
    });
    expect(e.lauf).toEqual({ runId: "lauf-z8-30t", status: "abgeschlossen" });
    expect(e.ergebnis).toEqual({ art: "erinnerung_zugestellt", am: "2026-10-31T08:00:00.000Z" });
    // Die zugestellte Erinnerung ist KEINE Verlängerung: die Frist bleibt offen.
    expect(e.status).toBe("offen");

    // Meldet der Nachweis etwas anderes, zeigt der Kalender genau das — ohne eigene Behauptung.
    dienst.laufEntfernen("auftrag-z8", "lauf-z8-30t");
    expect(await lies(app, k.erik, e.id)).toMatchObject({
      lauf: { runId: "lauf-z8-30t", status: null },
      ergebnis: null,
    });

    // NEGATIV · gefälschte Kennungen fallen durch.
    for (const [eingabe, grund] of [
      [{ auftrag: { taskId: "erfunden" } }, "verweis_unbekannt"],
      [{ auftrag: { taskId: "auftrag-z8" }, lauf: { runId: "erfunden" } }, "verweis_unbekannt"],
    ] as const) {
      const r = await lege(app, k.erik, { ...FRIST, ...eingabe });
      expect(r.statusCode, JSON.stringify(eingabe)).toBe(404);
      expect(r.json().grund).toBe(grund);
    }
    // NEGATIV · Ergebnis, Laufstand und Auftragstitel lassen sich nicht behaupten.
    for (const behauptung of [
      { ergebnis: { art: "erinnerung_zugestellt", am: "2026-10-31T08:00:00Z" } },
      { auftrag: { taskId: "auftrag-z8" }, lauf: { runId: "lauf-x", status: "abgeschlossen" } },
      { auftrag: { taskId: "auftrag-z8", titel: "Selbst ausgedacht" } },
    ]) {
      const r = await lege(app, k.erik, { ...FRIST, ...behauptung });
      expect(r.statusCode, JSON.stringify(behauptung)).toBe(400);
    }
    // Kein Lauf ohne Auftrag.
    expect((await lege(app, k.erik, { ...TERMIN, lauf: { runId: "lauf-x" } })).statusCode).toBe(
      400,
    );

    // NEGATIV · ein einfaches Teammitglied überschreibt weder Ergebnis noch Laufverweis.
    dienst.laufSetzen("auftrag-z8", "lauf-team", "abgeschlossen", {
      art: "lauf_abgeschlossen",
      am: "2026-10-30T08:00:00.000Z",
    });
    const teamRes = await lege(app, k.erik, {
      ...FRIST,
      bereich: "team",
      teamId: TEAM_ID,
      verantwortlich: ids.erik,
      auftrag: { taskId: "auftrag-z8" },
      lauf: { runId: "lauf-team" },
    });
    expect(teamRes.statusCode, teamRes.body).toBe(201);
    const t = teamRes.json().eintrag;
    const miaErgebnis = await aendere(app, k.mia, t.id, {
      fassung: t.fassung,
      ergebnis: { art: "erinnerung_zugestellt", am: "2026-10-31T08:00:00Z" },
    });
    expect(miaErgebnis.statusCode).toBe(400);
    const miaLauf = await aendere(app, k.mia, t.id, {
      fassung: t.fassung,
      lauf: { runId: "lauf-z8-30t" },
    });
    expect(miaLauf.statusCode).toBe(403);
    expect(miaLauf.json().grund).toBe("keine_steuerung");
    expect(await lies(app, k.erik, t.id)).toMatchObject({
      fassung: t.fassung,
      lauf: { runId: "lauf-team", status: "abgeschlossen" },
      ergebnis: { art: "lauf_abgeschlossen" },
    });
    // Auflösung mit HEUTIGEN Rechten am Nachweis: Lea ist Teammitglied, sieht den Auftrag dort aber
    // nicht — sie bekommt weder Titel noch Stand noch Ergebnis.
    expect(await lies(app, k.lea, t.id)).toMatchObject({
      auftrag: { taskId: "auftrag-z8", titel: null, aufgeloest: false },
      lauf: { runId: "lauf-team", status: null },
      ergebnis: null,
    });
  });

  it("K3 · ohne angebundenen Ausführungsdienst gibt es keine Lauf-/Serienverknüpfung und keine Ausführungsaktion", async () => {
    const { app, k } = await buehne({ ausfuehrung: null });
    // Nacharbeit 8: die gelieferten persönlichen Aufgaben sind angeschlossen — eine Kennung, die
    // dort für Erik nicht existiert, ist unbekannt (404), nicht „nicht angebunden". Lauf und Serie
    // brauchen weiter den Ausführungsdienst (409).
    const r = await lege(app, k.erik, { ...TERMIN, auftrag: { taskId: "auftrag-z8" } });
    expect(r.statusCode).toBe(404);
    expect(r.json().grund).toBe("verweis_unbekannt");
    const serie = await lege(app, k.erik, { ...TERMIN, serie: { seriesId: "serie-z8" } });
    expect(serie.statusCode).toBe(409);
    expect(serie.json().grund).toBe("ausfuehrung_nicht_angebunden");
    const e = (await lege(app, k.erik, TERMIN)).json().eintrag;
    for (const aktion of ["lauf_absagen", "arbeit_abbrechen", "serie_pausieren"]) {
      expect(await folgen(app, k.erik, e.id, aktion)).toMatchObject({
        moeglich: false,
        hinderung: "ausfuehrung_nicht_angebunden",
      });
    }
  });

  it("K4 · Sichtwahl eigen/vorhanden/beide zeigt die Termine des vorhandenen Kalenders; intern bleibt", async () => {
    const extern = new SimulierterVorhandenerKalender([
      {
        id: "extern-1",
        titel: "Lieferantentermin (fiktiv)",
        ganztaegig: false,
        beginn: "2026-10-13T08:00:00.000Z",
        ende: "2026-10-13T09:00:00.000Z",
      },
    ]);
    const { app, k } = await buehne({ vorhanden: extern });
    const frist = (await lege(app, k.erik, FRIST)).json().eintrag;
    const termin = (await lege(app, k.erik, TERMIN)).json().eintrag;
    const eigen = await ansicht(app, k.erik);
    expect(eigen.sichtmodus).toBe("eigen");
    // Im Modus „eigen" wird der vorhandene Kalender gar nicht gelesen.
    expect(eigen.vorhandenerKalender).toEqual({ verbunden: true, termine: [] });
    expect(extern.lesungen).toBe(0);
    for (const modus of ["vorhanden", "beide", "vorhanden"]) {
      const res = await app.inject({
        method: "PUT",
        url: "/api/me/kalender/einstellungen",
        headers: k.erik,
        payload: { sichtmodus: modus },
      });
      expect(res.statusCode, res.body).toBe(200);
      const a = await ansicht(app, k.erik);
      expect(a.sichtmodus).toBe(modus);
      expect(a.vorhandenerKalender.verbunden).toBe(true);
      expect(a.vorhandenerKalender.termine.map((x: { id: string }) => x.id)).toEqual(["extern-1"]);
      // Die externe Ansicht ersetzt nichts: beide internen Einträge sind weiter gespeichert.
      expect(a.eintraege.map((x: { id: string }) => x.id).sort()).toEqual(
        [frist.id, termin.id].sort(),
      );
    }
    expect(extern.lesungen).toBe(3);
    // Getrennt bleibt die Verbindung: meldet der Zugang „nicht verbunden", steht kein Termin da.
    extern.verbunden = false;
    expect((await ansicht(app, k.erik)).vorhandenerKalender).toEqual({
      verbunden: false,
      termine: [],
    });
    // Die Wahl gehört dem Konto und überlebt eine neue Sitzung; andere Konten bleiben beim Standard.
    expect((await ansicht(app, await anmelden(app, "erik@kalender.test"))).sichtmodus).toBe(
      "vorhanden",
    );
    expect((await ansicht(app, k.lea)).sichtmodus).toBe("eigen");
    const falsch = await app.inject({
      method: "PUT",
      url: "/api/me/kalender/einstellungen",
      headers: k.erik,
      payload: { sichtmodus: "outlook" },
    });
    expect(falsch.statusCode).toBe(400);
  });

  it("K4 · ohne angeschlossenen vorhandenen Kalender bleibt er in jedem Modus „nicht verbunden“", async () => {
    const { app, k } = await buehne();
    await lege(app, k.erik, FRIST);
    for (const modus of ["vorhanden", "beide"]) {
      await app.inject({
        method: "PUT",
        url: "/api/me/kalender/einstellungen",
        headers: k.erik,
        payload: { sichtmodus: modus },
      });
      const a = await ansicht(app, k.erik);
      expect(a.vorhandenerKalender).toEqual({ verbunden: false, termine: [] });
      expect(a.eintraege).toHaveLength(1);
    }
  });

  it("K5 · persönlich bleibt privat; unzugeordnet ist sichtbar und ohne Ausführungsauftrag", async () => {
    const dienst = new SimulierterAusfuehrungsdienst();
    dienst.auftragAnlegen("auftrag-begehung", "Begehung durchführen");
    const { app, k } = await buehne({ ausfuehrung: dienst });
    const privat = (await lege(app, k.erik, TERMIN)).json().eintrag;
    // Nicht im Teamkalender — weder für Erik noch für Lea.
    expect((await ansicht(app, k.erik, "team")).eintraege).toEqual([]);
    expect((await ansicht(app, k.lea, "team")).eintraege).toEqual([]);
    // Fremd und unbekannt antworten gleich — auch dem Admin.
    for (const kopf of [k.lea, k.admin]) {
      const fremd = await app.inject({
        method: "GET",
        url: `/api/me/kalender/eintraege/${privat.id}`,
        headers: kopf,
      });
      expect(fremd.statusCode).toBe(404);
    }

    const offen = await lege(app, k.lea, {
      ...TERMIN,
      bereich: "team",
      teamId: TEAM_ID,
      verantwortlich: null,
      titel: "Begehung Halle 3",
    });
    expect(offen.statusCode, offen.body).toBe(201);
    const teamEintrag = offen.json().eintrag;
    expect(teamEintrag).toMatchObject({ zugeordnet: false, verantwortlich: null, auftrag: null });
    const imTeam = (await ansicht(app, k.mia, "team")).eintraege;
    expect(imTeam.map((x: { id: string; zugeordnet: boolean }) => [x.id, x.zugeordnet])).toEqual([
      [teamEintrag.id, false],
    ]);
    // Unzugeordnet trägt keinen Ausführungsauftrag — weder beim Anlegen noch beim Ändern, auch wenn
    // der Auftrag im Ausführungsnachweis existiert.
    const mitAuftrag = await lege(app, k.erik, {
      ...TERMIN,
      bereich: "team",
      teamId: TEAM_ID,
      verantwortlich: null,
      auftrag: { taskId: "auftrag-begehung" },
    });
    expect(mitAuftrag.statusCode).toBe(409);
    expect(mitAuftrag.json().grund).toBe("unzugeordnet");
    const nachtraeglich = await aendere(app, k.erik, teamEintrag.id, {
      fassung: 1,
      auftrag: { taskId: "auftrag-begehung" },
    });
    expect(nachtraeglich.statusCode).toBe(409);
    // Wer nicht im Team ist, sieht nichts und kann dort nichts anlegen.
    expect((await ansicht(app, k.fritz, "team")).eintraege).toEqual([]);
    const fremdLegt = await lege(app, k.fritz, { ...TERMIN, bereich: "team", teamId: TEAM_ID });
    expect(fremdLegt.statusCode).toBe(404);
  });

  it("K6 · Anzeige entfernen, Lauf absagen, Serie pausieren, Arbeit abbrechen — Folgen zuerst, Wirkung nur bestätigt", async () => {
    const dienst = new SimulierterAusfuehrungsdienst();
    const { app, k } = await buehne({ ausfuehrung: dienst });
    dienst.auftragAnlegen("auftrag-wartung", "Wartung P-7");
    dienst.laufSetzen("auftrag-wartung", "lauf-1", "geplant");
    dienst.laufSetzen("auftrag-wartung", "lauf-2", "laeuft");
    dienst.serieAnlegen("serie-wartung-p7");
    const mitSerie = {
      ...TERMIN,
      auftrag: { taskId: "auftrag-wartung" },
      serie: { seriesId: "serie-wartung-p7" },
    };
    const a = (await lege(app, k.erik, { ...mitSerie, lauf: { runId: "lauf-1" } })).json().eintrag;
    const bRes = await lege(app, k.erik, {
      ...mitSerie,
      beginn: "2026-10-19T09:00:00+02:00",
      ende: null,
      lauf: { runId: "lauf-2" },
    });
    const b = bRes.json().eintrag;

    // Vier verschiedene Folgen — gezeigt, bevor sich etwas ändert.
    const f = {
      anzeige: await folgen(app, k.erik, a.id, "anzeige_entfernen"),
      lauf: await folgen(app, k.erik, a.id, "lauf_absagen"),
      serie: await folgen(app, k.erik, a.id, "serie_pausieren"),
      arbeit: await folgen(app, k.erik, b.id, "arbeit_abbrechen"),
    };
    expect(f.anzeige).toMatchObject({
      moeglich: true,
      betroffeneEintraege: 1,
      ausfuehrung: false,
    });
    expect(f.anzeige.bleibt).toEqual(
      expect.arrayContaining(["eintrag", "frist", "auftrag", "serie", "lauf"]),
    );
    expect(f.lauf).toMatchObject({ moeglich: true, umkehrbar: false, ausfuehrung: true });
    expect(f.lauf.bleibt).toEqual(expect.arrayContaining(["serie", "andere_laeufe"]));
    expect(f.serie).toMatchObject({ moeglich: true, betroffeneEintraege: 2, ausfuehrung: true });
    expect(f.serie.bleibt).toEqual(expect.arrayContaining(["eintraege", "laufende_arbeit"]));
    expect(f.arbeit).toMatchObject({ moeglich: true, umkehrbar: false, ausfuehrung: true });
    expect(await folgen(app, k.erik, a.id, "arbeit_abbrechen")).toMatchObject({
      moeglich: false,
      hinderung: "lauf_laeuft_nicht",
    });
    // Das Zeigen der Folgen hat nichts ausgelöst und nichts geändert.
    expect(dienst.wirkungen).toEqual([]);
    expect(await lies(app, k.erik, a.id)).toEqual(a);

    // Ohne ausdrückliche Bestätigung wirkt nichts.
    const unbestaetigt = await handeln(app, k.erik, a.id, "lauf_absagen", undefined);
    expect(unbestaetigt.statusCode).toBe(400);
    expect(unbestaetigt.json().grund).toBe("bestaetigung_fehlt");
    expect(dienst.wirkungen).toEqual([]);

    // Lauf absagen: der Dienst sagt ab, der Kalender liest „abgesagt" zurück. Serie und B bleiben.
    expect((await handeln(app, k.erik, a.id, "lauf_absagen", true)).statusCode).toBe(200);
    expect(dienst.wirkungen).toEqual([expect.stringMatching(/^laufAbsagen:.*:lauf-1$/)]);
    expect((await lies(app, k.erik, a.id)).lauf).toEqual({ runId: "lauf-1", status: "abgesagt" });
    expect((await lies(app, k.erik, a.id)).serie).toEqual({
      seriesId: "serie-wartung-p7",
      pausiert: false,
    });
    expect((await lies(app, k.erik, b.id)).lauf).toEqual({ runId: "lauf-2", status: "laeuft" });

    // Bestätigt der Dienst NICHT, behauptet der Kalender keinen Abbruch.
    dienst.bestaetigt = false;
    const abgelehnt = await handeln(app, k.erik, b.id, "arbeit_abbrechen", true);
    expect(abgelehnt.statusCode).toBe(409);
    expect(abgelehnt.json().grund).toBe("nicht_bestaetigt");
    expect((await lies(app, k.erik, b.id)).lauf).toEqual({ runId: "lauf-2", status: "laeuft" });
    dienst.bestaetigt = true;
    expect((await handeln(app, k.erik, b.id, "arbeit_abbrechen", true)).statusCode).toBe(200);
    expect((await lies(app, k.erik, b.id)).lauf).toEqual({
      runId: "lauf-2",
      status: "abgebrochen",
    });

    // Serie pausieren: beim Dienst, beide Einträge zeigen den zurückgelesenen Stand; kein Lauf.
    const pause = await handeln(app, k.erik, a.id, "serie_pausieren", true);
    expect(pause.statusCode, pause.body).toBe(200);
    expect(pause.json().folgen.betroffeneEintraege).toBe(2);
    expect((await lies(app, k.erik, b.id)).serie.pausiert).toBe(true);
    expect((await lies(app, k.erik, b.id)).lauf.status).toBe("abgebrochen");

    // Anzeige entfernen: der Eintrag bleibt bestehen, verschwindet nur aus der eigenen Ansicht.
    const vorher = dienst.wirkungen.length;
    expect((await handeln(app, k.erik, a.id, "anzeige_entfernen", true)).statusCode).toBe(200);
    expect(dienst.wirkungen).toHaveLength(vorher);
    const sicht = await ansicht(app, k.erik);
    expect(sicht.eintraege.map((x: { id: string }) => x.id)).toEqual([b.id]);
    expect(sicht.ausgeblendet).toBe(1);
    expect((await lies(app, k.erik, a.id)).ausgeblendet).toBe(true);
    expect((await ansicht(app, k.erik, "persoenlich", true)).eintraege).toHaveLength(2);
  });

  it("K7 · entzogene Quelle schützt den Ereignistext; Zugriff und Serienkontrolle mit heutigen Rechten je Eintrag", async () => {
    const dienst = new SimulierterAusfuehrungsdienst();
    const { services, app, k, ids } = await buehne({ ausfuehrung: dienst });
    dienst.auftragAnlegen("auftrag-b2", "Druckbehälter B-2 prüfen");
    dienst.serieAnlegen("serie-rundgang");
    const ko = await services.ko.create({
      title: "Prüfanweisung Druckbehälter B-2",
      statement: "Fiktive Prüfanweisung für den Kalendertest.",
      type: "best_practice",
      category: "Instandhaltung",
      author: "fiktiver-autor",
      // Ausdrücklich „intern": seit Entscheidung 16 (main) zählt eine fehlende Stufe wie
      // vertraulich — der Fall braucht eine Quelle, die Lea ZUERST sehen darf.
      confidentiality: "intern",
    });
    const abgeleitet = await lege(app, k.lea, {
      ...FRIST,
      titel: "Prüffrist Druckbehälter B-2",
      notiz: "Aus der Prüfanweisung abgeleitet.",
      herkunft: { art: "wissensobjekt", koId: ko.id },
      auftrag: { taskId: "auftrag-b2" },
    });
    expect(abgeleitet.statusCode, abgeleitet.body).toBe(201);
    const e = abgeleitet.json().eintrag;
    expect(e).toMatchObject({ titel: "Prüffrist Druckbehälter B-2", geschuetzt: false });
    expect(e.herkunft).toEqual({ art: "wissensobjekt", koId: ko.id });

    // Eine Quelle, die es nicht gibt oder die nicht offensteht, wird nicht angenommen.
    const erfunden = await lege(app, k.lea, {
      ...FRIST,
      herkunft: { art: "wissensobjekt", koId: "gibt-es-nicht" },
    });
    expect(erfunden.statusCode).toBe(404);

    // Rechteentzug an der Quelle: vertraulich, Lea ist weder Autorin noch Prüferin.
    await services.ko.setConfidentiality(ko.id, "vertraulich", "fiktiver-autor");
    expect(await lies(app, k.lea, e.id)).toMatchObject({
      id: e.id,
      geschuetzt: true,
      titel: null,
      notiz: null,
      herkunft: { art: "wissensobjekt", koId: null },
      auftrag: { taskId: "auftrag-b2", titel: null },
      beginn: "2026-11-30",
    });
    const inListe = JSON.stringify((await ansicht(app, k.lea)).eintraege);
    expect(inListe).not.toContain("Druckbehälter");
    expect(inListe).not.toContain(ko.id);
    const aendern = await aendere(app, k.lea, e.id, { fassung: 1, titel: "Neuer Titel" });
    expect(aendern.statusCode).toBe(409);
    expect(aendern.json().grund).toBe("quelle_geschuetzt");

    // EINE SERIE, VERSCHIEDENE VERANTWORTLICHE: Lea verantwortet Eintrag A, Mia Eintrag B.
    const teamA = (
      await lege(app, k.lea, {
        ...TERMIN,
        bereich: "team",
        teamId: TEAM_ID,
        verantwortlich: ids.lea,
        serie: { seriesId: "serie-rundgang" },
      })
    ).json().eintrag;
    const teamBRes = await lege(app, k.erik, {
      ...TERMIN,
      beginn: "2026-10-19T09:00:00+02:00",
      ende: null,
      bereich: "team",
      teamId: TEAM_ID,
      verantwortlich: ids.mia,
      serie: { seriesId: "serie-rundgang" },
    });
    expect(teamBRes.statusCode, teamBRes.body).toBe(201);
    const teamB = teamBRes.json().eintrag;
    expect(teamA.darfSteuern).toBe(true);
    // NEGATIV · Lea steuert A, aber nicht B — die Serienaktion wirkte auf B mit und ist verwehrt.
    for (const [kopf, id] of [
      [k.lea, teamA.id],
      [k.mia, teamB.id],
    ] as const) {
      expect(await folgen(app, kopf, id, "serie_pausieren")).toMatchObject({
        moeglich: false,
        hinderung: "serie_fremde_verantwortung",
      });
      const versuch = await handeln(app, kopf, id, "serie_pausieren", true);
      expect(versuch.statusCode).toBe(409);
    }
    expect(dienst.wirkungen).toEqual([]);
    expect((await lies(app, k.erik, teamB.id)).serie.pausiert).toBe(false);

    // Lea verlässt das Team: ab sofort kein Zugriff und keine Serienkontrolle mehr.
    await services.teams.lege(team(2, [ids.erik, ids.mia], ids.erik));
    const pfad = `/api/me/kalender/eintraege/${teamA.id}`;
    const nachEntzug = [
      await app.inject({ method: "GET", url: pfad, headers: k.lea }),
      await app.inject({
        method: "POST",
        url: `${pfad}/folgen`,
        headers: k.lea,
        payload: { aktion: "serie_pausieren" },
      }),
      await app.inject({
        method: "POST",
        url: `${pfad}/aktionen`,
        headers: k.lea,
        payload: { aktion: "serie_pausieren", bestaetigt: true },
      }),
    ];
    expect(nachEntzug.map((r) => r.statusCode)).toEqual([404, 404, 404]);
    expect((await ansicht(app, k.lea, "team")).eintraege).toEqual([]);
    // Der Teamzuständige steuert jeden Eintrag der Serie — mit SEINEM heutigen Recht.
    const erikPausiert = await handeln(app, k.erik, teamA.id, "serie_pausieren", true);
    expect(erikPausiert.statusCode, erikPausiert.body).toBe(200);
    expect(erikPausiert.json().folgen.betroffeneEintraege).toBe(2);
    expect(erikPausiert.json().eintrag.serie).toEqual({
      seriesId: "serie-rundgang",
      pausiert: true,
    });
    expect(dienst.wirkungen).toEqual([`serieSchalten:${ids.erik}:serie-rundgang:true`]);
  });
});
