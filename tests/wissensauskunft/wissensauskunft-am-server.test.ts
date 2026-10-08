// ================================================================================================
// WISSENSAUSKUNFT ZUM ZEITPUNKT · „Wer hat was gewusst und wann" (R-1644) — AM SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`)
// mit gestellter Uhr (nur `Date`). Ein Eintrag durchläuft eine datierte Geschichte — angelegt,
// kommentiert, überarbeitet, freigegeben, zur Kenntnisnahme verteilt, bestätigt, erneut
// überarbeitet — und die Auskunft wird zu Zeitpunkten dazwischen abgefragt.
// Getrennte Beispieldaten, keine produktiven Konten.
//
//   A1  Vor der Anlage: nicht vorhanden, keine Fassung, keine Person.
//   A2  Je Zeitpunkt die damals geltende Fassung samt Verfasser, Titel und Kernaussage.
//   A3  Je Person die bis dahin belegten Kontakte mit Art, Zeitpunkt und Fassung — nichts danach.
//   A4  Kenntnisnahme: angefordert vs. bestätigt, an die Fassung gebunden.
//   A5  Die Freigabe gilt der Fassung, für die sie belegt ist — nicht der späteren.
//   A6  Grenzen: bloßes Öffnen erzeugt keinen Beleg; die Auskunft nennt das und schreibt nichts.
//   A7  Tor: Controller/Admin; Zeitpunkt Pflicht und nicht in der Zukunft; unbekannt → 404.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { Wissensauskunft } from "../../services/app/src/wissensauskunft";

type App = ReturnType<typeof buildApp>;

const MINUTE = 60_000;
const T0 = Date.parse("2026-03-02T08:00:00.000Z");
const um = (minuten: number): string => new Date(T0 + minuten * MINUTE).toISOString();

let services: AppServices;
let app: App;
let admin = { id: "", token: "" };
let clara = { id: "", token: "" };
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };
let fiona = { id: "", token: "" };
let koId = "";

const auf = (wer: string, methode: "GET" | "POST", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string) {
  const angelegt = await auf(admin.token, "POST", "/api/users", {
    name,
    email,
    password: "secret123",
    role: rolle,
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

const stelle = (minuten: number): void => {
  vi.setSystemTime(T0 + minuten * MINUTE);
};

async function auskunft(wer: string, zeitpunkt: string): Promise<Wissensauskunft> {
  const antwort = await auf(
    wer,
    "GET",
    `/api/kos/${koId}/wissensauskunft?zeitpunkt=${encodeURIComponent(zeitpunkt)}`,
  );
  expect(antwort.statusCode, antwort.body).toBe(200);
  return antwort.json() as Wissensauskunft;
}

const belegeVon = (a: Wissensauskunft, id: string) =>
  (a.personen.find((p) => p.id === id)?.belege ?? []).map((b) => ({
    art: b.art,
    am: b.am,
    fassung: b.fassung,
  }));

/** Kein Beleg der Antwort liegt nach dem abgefragten Zeitpunkt. */
const nichtsDanach = (a: Wissensauskunft): void => {
  const grenze = Date.parse(a.zeitpunkt);
  const spaeter = a.personen.flatMap((p) =>
    p.belege.filter((b) => Date.parse(b.am) > grenze).map((b) => `${p.id}:${b.art}`),
  );
  expect(spaeter).toEqual([]);
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  stelle(-60);
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@wissensauskunft.test", password: "secret123" },
  });
  admin = {
    id: (await services.auth.listUsers())[0]?.id ?? "",
    token: await anmelden("ada@wissensauskunft.test"),
  };
  clara = await konto("controller", "clara@wissensauskunft.test", "Clara Controller");
  erik = await konto("experte", "erik@wissensauskunft.test", "Erik Experte");
  vera = await konto("viewer", "vera@wissensauskunft.test", "Vera Viewer");
  fiona = await konto("experte", "fiona@wissensauskunft.test", "Fiona Fachkraft");

  // Die datierte Geschichte des Eintrags.
  stelle(0);
  const angelegt = await auf(admin.token, "POST", "/api/kos", {
    confidentiality: "intern",
    title: "Druckprobe Leitung 7 vor Inbetriebnahme",
    statement: "Leitung 7 wird vor Inbetriebnahme mit 1,5-fachem Betriebsdruck geprüft.",
    type: "best_practice",
    category: "Anlage Beispiel",
  });
  expect(angelegt.statusCode).toBe(201);
  koId = (angelegt.json() as { id: string }).id;

  stelle(10);
  await services.ko.addComment(koId, erik.id, "Wie lange ist die Haltezeit?");

  stelle(20);
  const v2 = await services.ko.revise(
    koId,
    { statement: "Fassung 2: Prüfdruck 1,5-fach, Haltezeit 30 Minuten." },
    erik.id,
  );
  expect(v2.version).toBe(2);

  stelle(30);
  await services.validation.adminValidate(koId, admin.id);

  stelle(40);
  const anforderung = await auf(clara.token, "POST", `/api/kos/${koId}/kenntnisnahmen`, {
    fassung: 2,
    empfaenger: [vera.id, fiona.id],
  });
  expect(anforderung.statusCode).toBe(201);
  const anforderungId = (anforderung.json() as { anforderungId: string }).anforderungId;

  stelle(50);
  const bestaetigt = await auf(
    vera.token,
    "POST",
    `/api/kenntnisnahmen/${anforderungId}/bestaetigen`,
    { fassung: 2 },
  );
  expect(bestaetigt.statusCode).toBe(200);

  stelle(60);
  const v3 = await services.ko.revise(koId, { statement: "Fassung 3: Entwurf, 2-fach." }, admin.id);
  expect(v3.version).toBe(3);

  stelle(90);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("A1 · vor der Anlage gab es den Eintrag nicht", () => {
  it("nicht vorhanden, keine Fassung, keine Person", async () => {
    const a = await auskunft(clara.token, um(-5));
    expect(a.koId).toBe(koId);
    expect(a.zeitpunkt).toBe(um(-5));
    expect(a.vorhanden).toBe(false);
    expect(a.fassung).toBeNull();
    expect(a.freigabe).toBeNull();
    expect(a.personen).toEqual([]);
    expect(a.aktuelleFassung).toBe(3);
  });
});

describe("A2/A3 · die damals geltende Fassung und wer bis dahin belegt damit zu tun hatte", () => {
  it("nach Anlage und Kommentar, vor der Überarbeitung: Fassung V1, Ada angelegt, Erik kommentiert", async () => {
    const a = await auskunft(clara.token, um(15));
    expect(a.vorhanden).toBe(true);
    expect(a.imPapierkorb).toBe(false);
    expect(a.fassung).toMatchObject({
      version: 1,
      seit: um(0),
      von: { id: admin.id, name: "Ada Admin" },
      titel: "Druckprobe Leitung 7 vor Inbetriebnahme",
      aussage: "Leitung 7 wird vor Inbetriebnahme mit 1,5-fachem Betriebsdruck geprüft.",
    });
    expect(belegeVon(a, admin.id)).toContainEqual({ art: "angelegt", am: um(0), fassung: 1 });
    // `ko.commented` nennt keine Fassung — sie wird nicht aus dem Zeitpunkt geraten.
    expect(belegeVon(a, erik.id)).toEqual([{ art: "kommentiert", am: um(10), fassung: null }]);
    // Was danach geschah, steht nicht drin.
    nichtsDanach(a);
    expect(a.personen.map((p) => p.id).sort()).toEqual([admin.id, erik.id].sort());
    expect(a.personen.find((p) => p.id === erik.id)?.name).toBe("Erik Experte");
  });

  it("nach der Überarbeitung: Fassung V2 von Erik — mit Kommentar und Überarbeitung als Belege", async () => {
    const a = await auskunft(clara.token, um(25));
    expect(a.fassung).toMatchObject({ version: 2, seit: um(20), von: { id: erik.id } });
    expect(a.fassung?.aussage).toBe("Fassung 2: Prüfdruck 1,5-fach, Haltezeit 30 Minuten.");
    expect(belegeVon(a, erik.id)).toContainEqual({ art: "kommentiert", am: um(10), fassung: null });
    expect(belegeVon(a, erik.id)).toContainEqual({ art: "ueberarbeitet", am: um(20), fassung: 2 });
    nichtsDanach(a);
  });
});

describe("A4/A5 · Freigabe und Kenntnisnahme, je Fassung", () => {
  it("vor der Bestätigung: Fassung V2 freigegeben, Vera und Fiona nur angefordert", async () => {
    const a = await auskunft(clara.token, um(45));
    expect(a.fassung?.version).toBe(2);
    expect(a.freigabe).toEqual({ am: um(30), von: { id: admin.id, name: "Ada Admin" } });
    expect(belegeVon(a, admin.id)).toContainEqual({ art: "freigegeben", am: um(30), fassung: 2 });
    expect(belegeVon(a, clara.id)).toEqual([
      { art: "kenntnisnahme_verteilt", am: um(40), fassung: 2 },
    ]);
    expect(belegeVon(a, vera.id)).toEqual([
      { art: "kenntnisnahme_angefordert", am: um(40), fassung: 2 },
    ]);
    expect(belegeVon(a, fiona.id)).toEqual([
      { art: "kenntnisnahme_angefordert", am: um(40), fassung: 2 },
    ]);
    nichtsDanach(a);
  });

  it("nach Veras Bestätigung: Vera hat V2 bestätigt, Fiona weiter nur angefordert", async () => {
    const a = await auskunft(clara.token, um(55));
    expect(belegeVon(a, vera.id)).toEqual([
      { art: "kenntnisnahme_bestaetigt", am: um(50), fassung: 2 },
    ]);
    expect(belegeVon(a, fiona.id)).toEqual([
      { art: "kenntnisnahme_angefordert", am: um(40), fassung: 2 },
    ]);
  });

  it("nach der nächsten Überarbeitung: Fassung V3 ist nicht freigegeben, Veras Bestätigung bleibt an V2", async () => {
    const a = await auskunft(admin.token, um(70));
    expect(a.fassung).toMatchObject({ version: 3, seit: um(60), von: { id: admin.id } });
    expect(a.freigabe).toBeNull();
    expect(a.aktuelleFassung).toBe(3);
    expect(belegeVon(a, vera.id)).toEqual([
      { art: "kenntnisnahme_bestaetigt", am: um(50), fassung: 2 },
    ]);
    expect(belegeVon(a, admin.id)).toContainEqual({ art: "angelegt", am: um(0), fassung: 1 });
    expect(belegeVon(a, admin.id)).toContainEqual({ art: "freigegeben", am: um(30), fassung: 2 });
    expect(belegeVon(a, admin.id)).toContainEqual({ art: "ueberarbeitet", am: um(60), fassung: 3 });
    // Reihenfolge der Personen: nach ihrem ersten Beleg (Vera erst mit ihrer Bestätigung).
    expect(a.personen.map((p) => p.id)).toEqual([admin.id, erik.id, clara.id, fiona.id, vera.id]);
  });
});

describe("A6 · Grenzen ehrlich benannt; die Auskunft schreibt nichts", () => {
  it("bloßes Öffnen erzeugt keinen Beleg, und die Antwort nennt diese Grenze", async () => {
    stelle(91);
    const geoeffnet = await auf(fiona.token, "GET", `/api/kos/${koId}`);
    expect(geoeffnet.statusCode).toBe(200);
    stelle(92);
    const a = await auskunft(clara.token, um(92));
    expect(belegeVon(a, fiona.id)).toEqual([
      { art: "kenntnisnahme_angefordert", am: um(40), fassung: 2 },
    ]);
    expect(a.nichtErfasst).toEqual(["oeffnen", "pruefstatus", "antwortquellen"]);
  });

  it("die Abfrage selbst legt keinen Audit-Eintrag und keine Kenntnisnahme an", async () => {
    const vorher = (await services.audit.list({})).length;
    const kenntnisVorher = await services.kenntnisnahmen.anforderungenZu(koId);
    await auskunft(clara.token, um(45));
    await auskunft(admin.token, um(70));
    expect((await services.audit.list({})).length).toBe(vorher);
    expect(await services.kenntnisnahmen.anforderungenZu(koId)).toEqual(kenntnisVorher);
  });
});

describe("A7 · Tor, Eingabe und unbekannter Eintrag", () => {
  it("Experte und Viewer bekommen 403, ohne Anmeldung 401", async () => {
    const url = `/api/kos/${koId}/wissensauskunft?zeitpunkt=${encodeURIComponent(um(45))}`;
    expect((await auf(erik.token, "GET", url)).statusCode).toBe(403);
    expect((await auf(vera.token, "GET", url)).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
  });

  it("fehlender, ungültiger oder künftiger Zeitpunkt → 400 mit Grund", async () => {
    const ohne = await auf(clara.token, "GET", `/api/kos/${koId}/wissensauskunft`);
    expect(ohne.statusCode).toBe(400);
    expect(ohne.json()).toMatchObject({ grund: "zeitpunkt_ungueltig" });
    const kaputt = await auf(
      clara.token,
      "GET",
      `/api/kos/${koId}/wissensauskunft?zeitpunkt=gestern`,
    );
    expect(kaputt.json()).toMatchObject({ grund: "zeitpunkt_ungueltig" });
    const zukunft = await auf(
      clara.token,
      "GET",
      `/api/kos/${koId}/wissensauskunft?zeitpunkt=${encodeURIComponent(um(120))}`,
    );
    expect(zukunft.statusCode).toBe(400);
    expect(zukunft.json()).toMatchObject({ grund: "zeitpunkt_zukunft" });
  });

  it("ein unbekannter Eintrag antwortet 404", async () => {
    const antwort = await auf(
      clara.token,
      "GET",
      `/api/kos/gibt-es-nicht/wissensauskunft?zeitpunkt=${encodeURIComponent(um(45))}`,
    );
    expect(antwort.statusCode).toBe(404);
  });
});
