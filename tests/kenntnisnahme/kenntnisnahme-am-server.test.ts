// ================================================================================================
// KENNTNISNAHME EINER GÜLTIGEN FASSUNG · DER VORGANG AM SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos(), …))`, `app.inject`)
// mit gestellter Uhr. Nur die Vorbereitung der Fassungen (Überarbeiten, Gültigsetzen, Einstufen)
// läuft über die vorhandenen Dienste; jeder Schritt der Kenntnisnahme selbst geht über HTTP.
// Getrennte Beispieldaten, keine produktiven Konten.
//
//   K1  Anforderung für V2: Eintrag, Fassung, Empfängerkreis, Anfordernder, Zeitpunkt; kein Entwurf.
//   K2  Öffnen ohne Bestätigung bleibt ausstehend; nur die eigene Aktion bestätigt.
//   K3  V2-Bestätigung zählt nicht für V3; beide Vorgänge bleiben richtig zugeordnet.
//   K4  Doppelklick/Wiederholung erzeugt nichts doppelt; Stand überlebt Neuladen und Neuanmeldung.
//   K5  Nur Berechtigte fordern an und sehen die Übersicht; Entzug gibt nichts frei.
//   K6  Frist, Erinnerung, überfällig mit gestellter Uhr; ohne Frist nie verspätet.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

const START = Date.parse("2026-10-06T08:00:00.000Z");
const STUNDE = 3_600_000;
const TAG = 24 * STUNDE;

let jetzt = START;
let services: AppServices;
let app: App;
let admin = { id: "", token: "" };
let clara = { id: "", token: "" };
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };
let fiona = { id: "", token: "" };

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
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${admin.token}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

const auf = (wer: string, methode: "GET" | "POST", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

/** Ein Eintrag in Fassung V1 (Status offen). */
async function eintragV1(titel = "Druckprobe Leitung 7 vor Inbetriebnahme"): Promise<string> {
  const angelegt = await auf(admin.token, "POST", "/api/kos", {
    confidentiality: "intern",
    title: titel,
    statement: "Vor der Inbetriebnahme wird Leitung 7 mit 1,5-fachem Betriebsdruck geprüft.",
    type: "best_practice",
    category: "Anlage Beispiel",
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

/** Überarbeitet den Eintrag zur nächsten Fassung — sie ist danach ein Entwurf (offen). */
async function neueFassung(id: string, satz: string): Promise<number> {
  const ko = await services.ko.revise(id, { statement: satz }, admin.id);
  expect(ko.status).toBe("offen");
  return ko.version;
}

/** Setzt die aktuelle Fassung gültig — der Weg einer abgeschlossenen Prüfung. */
async function gueltig(id: string): Promise<number> {
  const ko = await services.ko.setValidationState(id, { trust: 80, status: "validiert" });
  expect(ko.status).toBe("validiert");
  return ko.version;
}

/** Ein Eintrag mit GÜLTIGER Fassung V2. */
async function eintragV2(): Promise<string> {
  const id = await eintragV1();
  expect(await neueFassung(id, "Fassung 2: Prüfdruck 1,5-fach, Haltezeit 30 Minuten.")).toBe(2);
  expect(await gueltig(id)).toBe(2);
  return id;
}

interface Empfaenger {
  id: string;
  name: string;
  status: string;
  bestaetigtAm: string | null;
  nachFrist: boolean;
  zugriff: boolean;
}
interface Anforderung {
  id: string;
  fassung: number;
  angefordertVon: { id: string; name: string };
  angefordertAm: string;
  frist: string | null;
  erinnertAm: string | null;
  zaehlung: Record<string, number>;
  empfaenger: Empfaenger[];
}
interface Uebersicht {
  koId: string;
  aktuelleFassung: number;
  gueltig: boolean;
  moeglicheEmpfaenger: Array<{ id: string; name: string }>;
  anforderungen: Anforderung[];
}
interface Eigene {
  anforderungId: string;
  koId: string;
  titel: string;
  fassung: number;
  status: string;
  bestaetigtAm: string | null;
}
interface Meldung {
  id: string;
  kind: string;
  koId?: string;
  fassung?: number;
  erinnerung?: boolean;
  ueberfaellig?: boolean;
  at: string;
}

const uebersicht = async (wer: string, koId: string): Promise<Uebersicht> => {
  const antwort = await auf(wer, "GET", `/api/kos/${koId}/kenntnisnahmen`);
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Uebersicht;
};
const meine = async (wer: string): Promise<Eigene[]> => {
  const antwort = await auf(wer, "GET", "/api/kenntnisnahmen/meine");
  expect(antwort.statusCode).toBe(200);
  return (antwort.json() as { eintraege: Eigene[] }).eintraege;
};
const kenntnisnahmeMeldungen = async (wer: string): Promise<Meldung[]> => {
  const antwort = await auf(wer, "GET", "/api/notifications");
  expect(antwort.statusCode).toBe(200);
  return (antwort.json() as Meldung[]).filter((m) => m.kind === "kenntnisnahme");
};
const anfordern = (koId: string, fassung: number, empfaenger: string[], frist?: string | null) =>
  auf(clara.token, "POST", `/api/kos/${koId}/kenntnisnahmen`, {
    fassung,
    empfaenger,
    ...(frist === undefined ? {} : { frist }),
  });
const bestaetigen = (wer: string, anforderungId: string, fassung: number) =>
  auf(wer, "POST", `/api/kenntnisnahmen/${anforderungId}/bestaetigen`, { fassung });
const empfaengerVon = (a: Anforderung, id: string): Empfaenger | undefined =>
  a.empfaenger.find((e) => e.id === id);

beforeEach(async () => {
  jetzt = START;
  services = assembleServices(inMemoryRepos(), { kenntnisnahmeUhr: () => jetzt });
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@kenntnisnahme.test", password: "secret123" },
  });
  admin = {
    id: (await services.auth.listUsers())[0]?.id ?? "",
    token: await anmelden("ada@kenntnisnahme.test"),
  };
  clara = await konto("controller", "clara@kenntnisnahme.test", "Clara Controller");
  erik = await konto("experte", "erik@kenntnisnahme.test", "Erik Experte");
  vera = await konto("viewer", "vera@kenntnisnahme.test", "Vera Viewer");
  fiona = await konto("experte", "fiona@kenntnisnahme.test", "Fiona Fachkraft");
});

describe("K1 · Anforderung der gültigen Fassung V2 — und kein Entwurf als Pflichtlektüre", () => {
  it("hält Eintrag, Fassung V2, Empfängerkreis, Anfordernden und Zeitpunkt fest", async () => {
    const id = await eintragV2();
    const antwort = await anfordern(id, 2, [erik.id, vera.id]);
    expect(antwort.statusCode).toBe(201);
    const ergebnis = antwort.json() as { angelegt: boolean; anforderungId: string; neu: string[] };
    expect(ergebnis.angelegt).toBe(true);
    expect([...ergebnis.neu].sort()).toEqual([erik.id, vera.id].sort());

    const stand = await uebersicht(clara.token, id);
    expect(stand.koId).toBe(id);
    expect(stand.aktuelleFassung).toBe(2);
    expect(stand.anforderungen).toHaveLength(1);
    const a = stand.anforderungen[0] as Anforderung;
    expect(a.id).toBe(ergebnis.anforderungId);
    expect(a.fassung).toBe(2);
    expect(a.angefordertVon).toEqual({ id: clara.id, name: "Clara Controller" });
    expect(a.angefordertAm).toBe(new Date(START).toISOString());
    expect(a.frist).toBeNull();
    expect(a.empfaenger.map((e) => e.id).sort()).toEqual([erik.id, vera.id].sort());
    expect(a.empfaenger.every((e) => e.status === "ausstehend")).toBe(true);
  });

  it("ein Entwurf (überarbeitete, noch nicht gültige Fassung) wird nicht verteilt", async () => {
    const id = await eintragV1();
    expect(await neueFassung(id, "Entwurf einer Fassung 2.")).toBe(2);
    const antwort = await anfordern(id, 2, [erik.id]);
    expect(antwort.statusCode).toBe(409);
    expect(antwort.json()).toMatchObject({ error: "CONFLICT", grund: "keine_gueltige_fassung" });
    expect((await uebersicht(clara.token, id)).anforderungen).toEqual([]);
    expect((await uebersicht(clara.token, id)).gueltig).toBe(false);
    expect(await meine(erik.token)).toEqual([]);
    expect(await kenntnisnahmeMeldungen(erik.token)).toEqual([]);
  });

  it("eine andere als die aktuelle gültige Fassung wird nicht angefordert", async () => {
    const id = await eintragV2();
    const antwort = await anfordern(id, 1, [erik.id]);
    expect(antwort.statusCode).toBe(409);
    expect(antwort.json()).toMatchObject({ grund: "fassung_veraltet", aktuelleFassung: 2 });
  });
});

describe("K2 · Öffnen bestätigt nichts — erst die ausdrückliche Aktion des Empfängers", () => {
  it("Detail, Fassungen, eigene Liste und Glocke lesen; der Status bleibt ausstehend", async () => {
    const id = await eintragV2();
    const anforderungId = (
      (await anfordern(id, 2, [erik.id, vera.id])).json() as { anforderungId: string }
    ).anforderungId;

    jetzt += STUNDE;
    expect((await auf(erik.token, "GET", `/api/kos/${id}`)).statusCode).toBe(200);
    expect((await auf(erik.token, "GET", `/api/kos/${id}/versions`)).statusCode).toBe(200);
    expect((await meine(erik.token)).map((e) => e.status)).toEqual(["ausstehend"]);
    expect(await kenntnisnahmeMeldungen(erik.token)).toHaveLength(1);
    const nachOeffnen = (await uebersicht(clara.token, id)).anforderungen[0] as Anforderung;
    expect(empfaengerVon(nachOeffnen, erik.id)).toMatchObject({
      status: "ausstehend",
      bestaetigtAm: null,
    });

    jetzt += STUNDE;
    const bestaetigt = await bestaetigen(erik.token, anforderungId, 2);
    expect(bestaetigt.statusCode).toBe(200);
    expect(bestaetigt.json()).toMatchObject({
      status: "bestaetigt",
      fassung: 2,
      bestaetigtAm: new Date(START + 2 * STUNDE).toISOString(),
      bereits: false,
    });
    const danach = (await uebersicht(clara.token, id)).anforderungen[0] as Anforderung;
    expect(empfaengerVon(danach, erik.id)).toMatchObject({
      status: "bestaetigt",
      bestaetigtAm: new Date(START + 2 * STUNDE).toISOString(),
    });
    // Die Bestätigung des einen ist keine des anderen.
    expect(empfaengerVon(danach, vera.id)).toMatchObject({
      status: "ausstehend",
      bestaetigtAm: null,
    });
    expect(await kenntnisnahmeMeldungen(erik.token)).toEqual([]);
  });

  it("niemand bestätigt für eine andere Person — auch nicht der Anfordernde", async () => {
    const id = await eintragV2();
    const anforderungId = ((await anfordern(id, 2, [erik.id])).json() as { anforderungId: string })
      .anforderungId;
    expect((await bestaetigen(clara.token, anforderungId, 2)).statusCode).toBe(404);
    expect((await bestaetigen(admin.token, anforderungId, 2)).statusCode).toBe(404);
    expect((await bestaetigen(fiona.token, anforderungId, 2)).statusCode).toBe(404);
    const a = (await uebersicht(clara.token, id)).anforderungen[0] as Anforderung;
    expect(empfaengerVon(a, erik.id)?.status).toBe("ausstehend");
  });
});

describe("K3 · eine Bestätigung zu V2 zählt nicht für V3", () => {
  it("V2 und V3 bleiben je eigener Vorgang; V2 ist bestätigt, V3 ausstehend", async () => {
    const id = await eintragV2();
    const v2 = ((await anfordern(id, 2, [erik.id, vera.id])).json() as { anforderungId: string })
      .anforderungId;
    jetzt += STUNDE;
    expect((await bestaetigen(erik.token, v2, 2)).statusCode).toBe(200);

    jetzt += TAG;
    expect(await neueFassung(id, "Fassung 3: Haltezeit 45 Minuten.")).toBe(3);
    // Solange V3 ein Entwurf ist, ist V2 überholt — und V3 nicht anforderbar.
    expect((await anfordern(id, 3, [erik.id])).statusCode).toBe(409);
    expect(await gueltig(id)).toBe(3);
    // Neuer Empfängerkreis für V3: Erik bleibt, Vera fällt weg, Fiona kommt dazu.
    const antwortV3 = await anfordern(id, 3, [erik.id, fiona.id]);
    expect(antwortV3.statusCode).toBe(201);
    const v3 = (antwortV3.json() as { anforderungId: string; bereits: string[] }).anforderungId;
    expect((antwortV3.json() as { bereits: string[] }).bereits).toEqual([]);

    const stand = await uebersicht(clara.token, id);
    expect(stand.anforderungen.map((a) => a.fassung)).toEqual([3, 2]);
    const a3 = stand.anforderungen.find((a) => a.id === v3) as Anforderung;
    const a2 = stand.anforderungen.find((a) => a.id === v2) as Anforderung;
    expect(empfaengerVon(a3, erik.id)).toMatchObject({ status: "ausstehend", bestaetigtAm: null });
    expect(empfaengerVon(a3, fiona.id)?.status).toBe("ausstehend");
    expect(empfaengerVon(a3, vera.id)).toBeUndefined();
    expect(empfaengerVon(a2, erik.id)).toMatchObject({
      status: "bestaetigt",
      bestaetigtAm: new Date(START + STUNDE).toISOString(),
    });
    expect(empfaengerVon(a2, vera.id)?.status).toBe("ueberholt");
    expect(a2.zaehlung).toEqual({ ausstehend: 0, bestaetigt: 1, ueberfaellig: 0, ueberholt: 1 });

    const eigene = await meine(erik.token);
    expect(eigene.map((e) => [e.fassung, e.status])).toEqual([
      [3, "ausstehend"],
      [2, "bestaetigt"],
    ]);
  });

  it("eine überholte V2 lässt sich nicht mehr bestätigen; V3 nicht mit Fassung 2", async () => {
    const id = await eintragV2();
    const v2 = ((await anfordern(id, 2, [vera.id])).json() as { anforderungId: string })
      .anforderungId;
    await neueFassung(id, "Fassung 3.");
    await gueltig(id);
    const v3 = ((await anfordern(id, 3, [vera.id])).json() as { anforderungId: string })
      .anforderungId;

    const ueberholt = await bestaetigen(vera.token, v2, 2);
    expect(ueberholt.statusCode).toBe(409);
    expect(ueberholt.json()).toMatchObject({ grund: "ueberholt", aktuelleFassung: 3 });
    const falscheFassung = await bestaetigen(vera.token, v3, 2);
    expect(falscheFassung.statusCode).toBe(409);
    expect(falscheFassung.json()).toMatchObject({ grund: "fassung_abweichend" });
    expect((await bestaetigen(vera.token, v3, 3)).statusCode).toBe(200);
    const stand = await uebersicht(clara.token, id);
    const a2 = stand.anforderungen.find((a) => a.id === v2) as Anforderung;
    const a3 = stand.anforderungen.find((a) => a.id === v3) as Anforderung;
    expect(empfaengerVon(a2, vera.id)).toMatchObject({ status: "ueberholt", bestaetigtAm: null });
    expect(empfaengerVon(a3, vera.id)?.status).toBe("bestaetigt");
  });
});

describe("K4 · nichts doppelt — und der Stand überlebt Neuladen und Neuanmeldung", () => {
  it("eine wiederholte Anforderung legt keine zweite Aufforderung an", async () => {
    const id = await eintragV2();
    expect((await anfordern(id, 2, [erik.id, vera.id])).statusCode).toBe(201);
    const zweite = await anfordern(id, 2, [erik.id, vera.id]);
    expect(zweite.statusCode).toBe(200);
    expect(zweite.json()).toMatchObject({ angelegt: false, anforderungId: null, neu: [] });
    expect([...(zweite.json() as { bereits: string[] }).bereits].sort()).toEqual(
      [erik.id, vera.id].sort(),
    );
    // Teilweise neu: nur Fiona kommt hinzu, Erik nicht ein zweites Mal.
    const dritte = await anfordern(id, 2, [erik.id, fiona.id]);
    expect(dritte.statusCode).toBe(201);
    expect(dritte.json()).toMatchObject({ neu: [fiona.id], bereits: [erik.id] });

    const stand = await uebersicht(clara.token, id);
    const alle = stand.anforderungen.flatMap((a) => a.empfaenger.map((e) => e.id));
    expect(alle.sort()).toEqual([erik.id, vera.id, fiona.id].sort());
    expect(await meine(erik.token)).toHaveLength(1);
    expect(await kenntnisnahmeMeldungen(erik.token)).toHaveLength(1);
  });

  it("zwei gleichzeitige Anforderungen (Doppelklick) ergeben genau eine", async () => {
    const id = await eintragV2();
    const [a, b] = await Promise.all([anfordern(id, 2, [erik.id]), anfordern(id, 2, [erik.id])]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
    expect((await uebersicht(clara.token, id)).anforderungen).toHaveLength(1);
  });

  it("doppelte Bestätigung bleibt eine; der Stand überlebt Neuladen und neue Anmeldung", async () => {
    const id = await eintragV2();
    const anforderungId = ((await anfordern(id, 2, [erik.id])).json() as { anforderungId: string })
      .anforderungId;
    jetzt += STUNDE;
    const [eins, zwei] = await Promise.all([
      bestaetigen(erik.token, anforderungId, 2),
      bestaetigen(erik.token, anforderungId, 2),
    ]);
    expect([eins.statusCode, zwei.statusCode]).toEqual([200, 200]);
    const zeit = new Date(START + STUNDE).toISOString();
    expect((eins.json() as { bestaetigtAm: string }).bestaetigtAm).toBe(zeit);
    expect((zwei.json() as { bestaetigtAm: string }).bestaetigtAm).toBe(zeit);
    expect(
      [eins.json() as { bereits: boolean }, zwei.json() as { bereits: boolean }].filter(
        (x) => x.bereits,
      ),
    ).toHaveLength(1);

    // Später noch einmal: der erste Zeitpunkt bleibt.
    jetzt += TAG;
    const spaeter = await bestaetigen(erik.token, anforderungId, 2);
    expect(spaeter.json()).toMatchObject({ bestaetigtAm: zeit, bereits: true });

    // Neuladen: dieselbe Sitzung liest erneut.
    expect((await meine(erik.token))[0]).toMatchObject({
      status: "bestaetigt",
      bestaetigtAm: zeit,
    });
    // Erneute Anmeldung: Abmelden, dann eine NEUE Sitzung.
    const abmelden = await auf(erik.token, "POST", "/api/auth/logout");
    expect(abmelden.statusCode).toBeLessThan(300);
    expect((await auf(erik.token, "GET", "/api/kenntnisnahmen/meine")).statusCode).toBe(401);
    const neu = await anmelden("erik@kenntnisnahme.test");
    expect(neu).not.toBe(erik.token);
    expect((await meine(neu))[0]).toMatchObject({ status: "bestaetigt", bestaetigtAm: zeit });
    const a = (await uebersicht(await anmelden("clara@kenntnisnahme.test"), id))
      .anforderungen[0] as Anforderung;
    expect(a.empfaenger).toEqual([expect.objectContaining({ id: erik.id, bestaetigtAm: zeit })]);
  });
});

describe("K5 · nur Berechtigte — und Entzug gibt nichts frei", () => {
  it("ohne Zuweisungsrecht kein Anfordern, keine Übersicht, kein Erinnern", async () => {
    const id = await eintragV2();
    const anforderungId = ((await anfordern(id, 2, [erik.id])).json() as { anforderungId: string })
      .anforderungId;
    for (const wer of [erik.token, vera.token]) {
      const versuch = await auf(wer, "POST", `/api/kos/${id}/kenntnisnahmen`, {
        fassung: 2,
        empfaenger: [vera.id],
      });
      expect(versuch.statusCode).toBe(403);
      expect((await auf(wer, "GET", `/api/kos/${id}/kenntnisnahmen`)).statusCode).toBe(403);
      expect(
        (await auf(wer, "POST", `/api/kenntnisnahmen/${anforderungId}/erinnern`)).statusCode,
      ).toBe(403);
    }
    expect((await app.inject({ method: "GET", url: "/api/kenntnisnahmen/meine" })).statusCode).toBe(
      401,
    );
  });

  it("die eigene Liste nennt keine fremden Empfänger", async () => {
    const id = await eintragV2();
    await anfordern(id, 2, [erik.id, vera.id]);
    const roh = (await auf(erik.token, "GET", "/api/kenntnisnahmen/meine")).body;
    expect(roh).not.toContain(vera.id);
    expect(roh).not.toContain("Vera Viewer");
    expect(roh).not.toContain("zaehlung");
  });

  it("eine Anforderung gibt keinen Zugriff: Empfänger ohne Leserecht werden abgewiesen", async () => {
    const id = await eintragV2();
    await services.ko.setConfidentiality(id, "vertraulich", admin.id);
    const stand = await uebersicht(clara.token, id);
    expect(stand.moeglicheEmpfaenger.map((k) => k.id)).not.toContain(erik.id);
    expect(stand.moeglicheEmpfaenger.map((k) => k.id)).toContain(clara.id);
    const antwort = await anfordern(id, 2, [erik.id, clara.id]);
    expect(antwort.statusCode).toBe(400);
    expect(antwort.json()).toMatchObject({
      grund: "empfaenger_ohne_zugriff",
      empfaenger: [erik.id],
    });
    expect((await uebersicht(clara.token, id)).anforderungen).toEqual([]);
    expect((await anfordern(id, 2, ["gibt-es-nicht"])).statusCode).toBe(400);
  });

  it("ein nach der Anforderung entzogener Zugriff sperrt Inhalt, Glocke und Bestätigung", async () => {
    const id = await eintragV2();
    const anforderungId = (
      (await anfordern(id, 2, [erik.id, vera.id])).json() as { anforderungId: string }
    ).anforderungId;
    await services.ko.setConfidentiality(id, "vertraulich", admin.id);

    expect((await auf(erik.token, "GET", `/api/kos/${id}`)).statusCode).toBe(404);
    expect(await meine(erik.token)).toEqual([]);
    expect(await kenntnisnahmeMeldungen(erik.token)).toEqual([]);
    const versuch = await bestaetigen(erik.token, anforderungId, 2);
    expect(versuch.statusCode).toBe(404);
    expect(versuch.body).not.toContain("Druckprobe");

    const a = (await uebersicht(clara.token, id)).anforderungen[0] as Anforderung;
    expect(empfaengerVon(a, erik.id)).toMatchObject({ status: "ausstehend", zugriff: false });
    expect(empfaengerVon(a, vera.id)).toMatchObject({ status: "ausstehend", zugriff: false });
  });

  it("verliert der Anfordernde sein Zuweisungsrecht, ist die Übersicht zu", async () => {
    const id = await eintragV2();
    await anfordern(id, 2, [erik.id]);
    const herab = await app.inject({
      method: "PUT",
      url: `/api/users/${clara.id}`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { role: "experte" },
    });
    expect(herab.statusCode).toBeLessThan(300);
    expect((await auf(clara.token, "GET", `/api/kos/${id}/kenntnisnahmen`)).statusCode).toBe(403);
  });

  it("eine erfundene Anforderung ist für jeden 404", async () => {
    expect((await bestaetigen(erik.token, "gibt-es-nicht", 2)).statusCode).toBe(404);
    expect(
      (await auf(clara.token, "POST", "/api/kenntnisnahmen/gibt-es-nicht/erinnern")).statusCode,
    ).toBe(404);
    const uebersichtFehlt = await auf(clara.token, "GET", "/api/kos/gibt-es-nicht/kenntnisnahmen");
    expect(uebersichtFehlt.statusCode).toBe(404);
  });
});

describe("K6 · Frist, Erinnerung und überfällig mit gestellter Uhr", () => {
  it("mit Frist wird nach Ablauf überfällig; ohne Frist bleibt es ausstehend", async () => {
    const id = await eintragV2();
    const frist = new Date(START + TAG).toISOString();
    const kennung = async (antwort: ReturnType<typeof anfordern>): Promise<string> =>
      ((await antwort).json() as { anforderungId: string }).anforderungId;
    const mitFrist = await kennung(anfordern(id, 2, [erik.id], frist));
    const ohneFrist = await kennung(anfordern(id, 2, [vera.id], null));
    const anforderungVon = (s: Uebersicht, a: string): Anforderung =>
      s.anforderungen.find((x) => x.id === a) as Anforderung;

    // Genau zur Frist ist noch nichts verspätet.
    jetzt = START + TAG;
    let stand = await uebersicht(clara.token, id);
    expect(empfaengerVon(anforderungVon(stand, mitFrist), erik.id)?.status).toBe("ausstehend");

    jetzt = START + TAG + 1;
    stand = await uebersicht(clara.token, id);
    const a1 = stand.anforderungen.find((a) => a.id === mitFrist) as Anforderung;
    const a2 = stand.anforderungen.find((a) => a.id === ohneFrist) as Anforderung;
    expect(a1.frist).toBe(frist);
    expect(empfaengerVon(a1, erik.id)?.status).toBe("ueberfaellig");
    expect(a1.zaehlung.ueberfaellig).toBe(1);
    expect(a2.frist).toBeNull();
    expect(empfaengerVon(a2, vera.id)?.status).toBe("ausstehend");

    // Ein Jahr später: ohne Frist gibt es weiterhin kein „überfällig".
    jetzt = START + 365 * TAG;
    stand = await uebersicht(clara.token, id);
    const ohne = stand.anforderungen.find((a) => a.id === ohneFrist) as Anforderung;
    expect(empfaengerVon(ohne, vera.id)?.status).toBe("ausstehend");
    expect(ohne.zaehlung.ueberfaellig).toBe(0);
    expect((await kenntnisnahmeMeldungen(vera.token))[0]?.ueberfaellig).toBe(false);
    expect((await kenntnisnahmeMeldungen(erik.token))[0]?.ueberfaellig).toBe(true);

    // Eine Bestätigung nach Ablauf ist bestätigt — und als „nach Frist" erkennbar.
    expect((await bestaetigen(erik.token, mitFrist, 2)).statusCode).toBe(200);
    const spaet = (await uebersicht(clara.token, id)).anforderungen.find(
      (a) => a.id === mitFrist,
    ) as Anforderung;
    expect(empfaengerVon(spaet, erik.id)).toMatchObject({ status: "bestaetigt", nachFrist: true });
  });

  it("eine Frist in der Vergangenheit oder ohne Datum wird abgewiesen", async () => {
    const id = await eintragV2();
    const vorbei = await anfordern(id, 2, [erik.id], new Date(START - 1).toISOString());
    expect(vorbei.statusCode).toBe(400);
    expect(vorbei.json()).toMatchObject({ grund: "frist_ungueltig" });
    expect((await anfordern(id, 2, [erik.id], "irgendwann")).statusCode).toBe(400);
    expect((await uebersicht(clara.token, id)).anforderungen).toEqual([]);
  });

  it("die Erinnerung erreicht nur Offene über die vorhandene Glocke — je Anforderung ein Eintrag", async () => {
    const id = await eintragV2();
    const anforderungId = (
      (await anfordern(id, 2, [erik.id, vera.id], new Date(START + TAG).toISOString())).json() as {
        anforderungId: string;
      }
    ).anforderungId;
    const vorher = await kenntnisnahmeMeldungen(erik.token);
    expect(vorher).toHaveLength(1);
    expect(vorher[0]).toMatchObject({
      id: `kn-${anforderungId}`,
      koId: id,
      fassung: 2,
      erinnerung: false,
    });

    jetzt += STUNDE;
    expect((await bestaetigen(vera.token, anforderungId, 2)).statusCode).toBe(200);
    jetzt += STUNDE;
    const erinnernPfad = `/api/kenntnisnahmen/${anforderungId}/erinnern`;
    const erinnert = await auf(clara.token, "POST", erinnernPfad);
    expect(erinnert.statusCode).toBe(200);
    expect(erinnert.json()).toEqual({ erinnert: 1 });
    const zeit = new Date(START + 2 * STUNDE).toISOString();
    expect((await uebersicht(clara.token, id)).anforderungen[0]?.erinnertAm).toBe(zeit);

    const nachher = await kenntnisnahmeMeldungen(erik.token);
    expect(nachher).toHaveLength(1);
    expect(nachher[0]).toMatchObject({
      id: `kn-${anforderungId}-${zeit}`,
      at: zeit,
      erinnerung: true,
      ueberfaellig: false,
    });
    // Die bereits bestätigte Vera wird nicht erinnert.
    expect(await kenntnisnahmeMeldungen(vera.token)).toEqual([]);

    jetzt += STUNDE;
    expect((await bestaetigen(erik.token, anforderungId, 2)).statusCode).toBe(200);
    const leer = await auf(clara.token, "POST", erinnernPfad);
    expect(leer.json()).toEqual({ erinnert: 0 });
    expect(await kenntnisnahmeMeldungen(erik.token)).toEqual([]);
  });
});
