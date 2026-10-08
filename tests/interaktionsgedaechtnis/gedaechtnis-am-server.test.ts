// ================================================================================================
// R-0466 · DAS INTERAKTIONSGEDÄCHTNIS AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`).
// Jeder Schritt des Gedächtnisses geht über HTTP; nur der Antwortdatensatz, auf den sich eine
// Herkunft beruft, wird über die vorhandene Antwortablage angelegt. Getrennte Beispieldaten.
//
//   G1  Frage/Antwort und Vorliebe merken und lesen — mit Herkunft, Frist und Vertraulichkeit.
//   G2  Herkunft „antwort" nur mit einer EIGENEN Antwort; fremd und unbekannt antworten gleich.
//   G3  Je Konto getrennt: kein fremder Eintrag sichtbar, kein fremder Eintrag löschbar.
//   G4  Einzeln und ganz löschen; das Prüfprotokoll trägt die Ereignisse, nie den Inhalt.
//   G5  Ohne Anmeldung keine Tür; haltbar im Postgres-Betrieb und vom Aufräumlauf erfasst.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  GEDAECHTNIS_ALLES_VERGESSEN,
  GEDAECHTNIS_GEMERKT,
  GEDAECHTNIS_VERGESSEN,
} from "../../services/app/src/routes/gedaechtnis-routes";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };

const URL_GEDAECHTNIS = "/api/me/gedaechtnis";
const GEHEIME_FRAGE = "Wie lautet die Notabschaltung von Presse 4?";
const GEHEIME_ANTWORT = "Schlüsselschalter S4 drehen, dann Not-Aus.";

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

const auf = (wer: string, methode: "GET" | "POST" | "DELETE", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

interface Sicht {
  id: string;
  art: string;
  inhalt: string;
  antwort: string | null;
  herkunft: { art: string; antwortId: string | null; antwortAm: string | null };
  vertraulichkeit: string;
  aufbewahrungTage: number;
  angelegtAm: string;
  verfallAm: string;
}

async function lies(wer: string): Promise<Sicht[]> {
  const antwort = await auf(wer, "GET", URL_GEDAECHTNIS);
  expect(antwort.statusCode).toBe(200);
  return (antwort.json() as { eintraege: Sicht[] }).eintraege;
}

async function merke(wer: string, eingabe: Record<string, unknown>): Promise<Sicht> {
  const antwort = await auf(wer, "POST", URL_GEDAECHTNIS, eingabe);
  expect(antwort.statusCode, antwort.body).toBe(201);
  return (antwort.json() as { eintrag: Sicht }).eintrag;
}

async function eigeneAntwort(userId: string, answerId: string): Promise<void> {
  expect(
    await services.answerSnapshots.createRecord({
      answerId,
      askExecutionId: `exec-${answerId}`,
      createdAt: "2026-10-07T09:30:00.000Z",
      schemaVersion: 1,
      owner: { kind: "user", userId },
    }),
  ).toBe(true);
}

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@gedaechtnis.test", password: "secret123" },
  });
  const adminToken = await anmelden("ada@gedaechtnis.test");
  erik = await konto(adminToken, "experte", "erik@gedaechtnis.test", "Erik Experte");
  vera = await konto(adminToken, "viewer", "vera@gedaechtnis.test", "Vera Viewer");
});

describe("G1 · Fragen, Antworten und Vorlieben als eigenes Gedächtnis", () => {
  it("merkt eine Vorliebe und eine Frage samt Antwort — jede mit Herkunft, Frist, Vertraulichkeit", async () => {
    const vorliebe = await merke(erik.token, { art: "vorliebe", inhalt: "Bitte mit Quellen." });
    const frage = await merke(erik.token, {
      art: "frage_antwort",
      inhalt: "Welche Haltezeit gilt?",
      antwort: "30 Minuten.",
      vertraulichkeit: "intern",
      aufbewahrungTage: 365,
    });

    expect(vorliebe).toMatchObject({
      art: "vorliebe",
      antwort: null,
      herkunft: { art: "eigene_eingabe", antwortId: null, antwortAm: null },
      vertraulichkeit: "vertraulich",
      aufbewahrungTage: 90,
    });
    expect(Date.parse(vorliebe.verfallAm) - Date.parse(vorliebe.angelegtAm)).toBe(90 * 86_400_000);
    expect(frage).toMatchObject({
      art: "frage_antwort",
      inhalt: "Welche Haltezeit gilt?",
      antwort: "30 Minuten.",
      vertraulichkeit: "intern",
      aufbewahrungTage: 365,
    });

    const antwort = await auf(erik.token, "GET", URL_GEDAECHTNIS);
    const koerper = antwort.json() as Record<string, unknown> & { eintraege: Sicht[] };
    expect(koerper.eintraege.map((e) => e.id).sort()).toEqual([vorliebe.id, frage.id].sort());
    expect(koerper.fristenTage).toEqual([30, 90, 365]);
    expect(koerper.standardFristTage).toBe(90);
    expect(koerper.standardVertraulichkeit).toBe("vertraulich");
    // Die Kontokennung geht nicht hinaus — der Fragende ist sie selbst.
    expect(antwort.body).not.toContain(erik.id);
  });

  it("eine unzulässige Eingabe legt nichts an", async () => {
    const antwort = await auf(erik.token, "POST", URL_GEDAECHTNIS, {
      art: "vorliebe",
      inhalt: "x",
      aufbewahrungTage: 100_000,
    });
    expect(antwort.statusCode).toBe(400);
    expect(antwort.json()).toMatchObject({ error: "VALIDATION", grund: "eingabe" });
    expect(await lies(erik.token)).toEqual([]);
  });
});

describe("G2 · Herkunft „antwort“ nur mit einer eigenen Antwort", () => {
  it("übernimmt Kennung und Zeitpunkt der eigenen Antwort", async () => {
    await eigeneAntwort(erik.id, "ans-erik-1");
    const e = await merke(erik.token, {
      art: "frage_antwort",
      inhalt: "Prüfdruck Leitung 7?",
      antwort: "1,5-facher Betriebsdruck.",
      antwortId: "ans-erik-1",
    });
    expect(e.herkunft).toEqual({
      art: "antwort",
      antwortId: "ans-erik-1",
      antwortAm: "2026-10-07T09:30:00.000Z",
    });
  });

  it("eine fremde und eine unbekannte Antwortkennung antworten gleich — 404, nichts angelegt", async () => {
    await eigeneAntwort(erik.id, "ans-erik-2");
    const fremd = await auf(vera.token, "POST", URL_GEDAECHTNIS, {
      art: "frage_antwort",
      inhalt: "F",
      antwort: "A",
      antwortId: "ans-erik-2",
    });
    const unbekannt = await auf(vera.token, "POST", URL_GEDAECHTNIS, {
      art: "frage_antwort",
      inhalt: "F",
      antwort: "A",
      antwortId: "ans-gibt-es-nicht",
    });
    expect([fremd.statusCode, unbekannt.statusCode]).toEqual([404, 404]);
    expect(fremd.body).toBe(unbekannt.body);
    expect(await lies(vera.token)).toEqual([]);
  });
});

describe("G3 · Je Konto getrennt", () => {
  it("kein fremder Eintrag ist sichtbar, und keiner ist von fremder Hand löschbar", async () => {
    const eriks = await merke(erik.token, { art: "vorliebe", inhalt: "Eriks Vorliebe" });
    expect(await lies(vera.token)).toEqual([]);

    const fremdLoeschen = await auf(vera.token, "DELETE", `${URL_GEDAECHTNIS}/${eriks.id}`);
    const unbekanntLoeschen = await auf(vera.token, "DELETE", `${URL_GEDAECHTNIS}/gibt-es-nicht`);
    expect([fremdLoeschen.statusCode, unbekanntLoeschen.statusCode]).toEqual([404, 404]);
    expect(fremdLoeschen.body).toBe(unbekanntLoeschen.body);

    const allesVera = await auf(vera.token, "DELETE", URL_GEDAECHTNIS);
    expect(allesVera.json()).toEqual({ geloescht: 0 });
    expect((await lies(erik.token)).map((e) => e.id)).toEqual([eriks.id]);
  });
});

describe("G4 · Löschbarkeit — und ein Prüfprotokoll ohne Inhalt", () => {
  it("löscht einzeln und ganz; das Protokoll trägt die Ereignisse, nie Frage, Antwort oder Vorliebe", async () => {
    const eins = await merke(erik.token, {
      art: "frage_antwort",
      inhalt: GEHEIME_FRAGE,
      antwort: GEHEIME_ANTWORT,
    });
    await merke(erik.token, { art: "vorliebe", inhalt: "Bitte nur deutsch." });
    await merke(erik.token, { art: "vorliebe", inhalt: "Bitte kurze Sätze." });

    const einzeln = await auf(erik.token, "DELETE", `${URL_GEDAECHTNIS}/${eins.id}`);
    expect([einzeln.statusCode, einzeln.json()]).toEqual([200, { geloescht: 1 }]);
    expect((await lies(erik.token)).map((e) => e.inhalt).sort()).toEqual([
      "Bitte kurze Sätze.",
      "Bitte nur deutsch.",
    ]);
    // Ein zweites Löschen findet nichts mehr.
    const nochmal = await auf(erik.token, "DELETE", `${URL_GEDAECHTNIS}/${eins.id}`);
    expect(nochmal.statusCode).toBe(404);

    const ganz = await auf(erik.token, "DELETE", URL_GEDAECHTNIS);
    expect([ganz.statusCode, ganz.json()]).toEqual([200, { geloescht: 2 }]);
    expect(await lies(erik.token)).toEqual([]);

    const gemerkt = await services.audit.list({ action: GEDAECHTNIS_GEMERKT });
    const vergessen = await services.audit.list({ action: GEDAECHTNIS_VERGESSEN });
    const alles = await services.audit.list({ action: GEDAECHTNIS_ALLES_VERGESSEN });
    expect(gemerkt).toHaveLength(3);
    expect(vergessen.map((e) => e.target)).toEqual([`gedaechtnis:${eins.id}`]);
    expect(alles).toHaveLength(1);
    expect(alles[0]?.payload?.geloescht).toBe(2);
    expect(gemerkt.every((e) => e.actor === erik.id)).toBe(true);

    const protokoll = JSON.stringify([...gemerkt, ...vergessen, ...alles]);
    for (const inhalt of [GEHEIME_FRAGE, GEHEIME_ANTWORT, "Bitte nur deutsch.", "Bitte kurze"]) {
      expect(protokoll).not.toContain(inhalt);
    }
  });
});

describe("G5 · Tür, Haltbarkeit und Aufräumlauf", () => {
  it("ohne Anmeldung ist jede der vier Türen zu", async () => {
    const versuche = await Promise.all([
      auf("", "GET", URL_GEDAECHTNIS),
      auf("", "POST", URL_GEDAECHTNIS, { art: "vorliebe", inhalt: "x" }),
      auf("", "DELETE", `${URL_GEDAECHTNIS}/irgendwas`),
      auf("", "DELETE", URL_GEDAECHTNIS),
    ]);
    expect(versuche.map((v) => v.statusCode)).toEqual([401, 401, 401, 401]);
  });

  it("der Postgres-Betrieb hängt die haltbare Ablage ein, und der Server startet den Aufräumlauf", () => {
    const wurzel = readFileSync(
      new URL("../../services/app/src/build-app.ts", import.meta.url),
      "utf8",
    );
    expect(wurzel).toMatch(/gedaechtnis: new PgGedaechtnisRepo\(pool\)/);
    const server = readFileSync(
      new URL("../../services/app/src/server.ts", import.meta.url),
      "utf8",
    );
    expect(server).toMatch(/new GedaechtnisDienst\(\{ repo: services\.gedaechtnis \}\)/);
    expect(server).toMatch(/runSweep: \(\) => gedaechtnis\.raeumeAbgelaufeneAuf\(\)/);
  });
});
