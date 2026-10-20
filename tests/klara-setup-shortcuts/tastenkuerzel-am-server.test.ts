// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung (AA-03) · DIE KLARA-KÜRZEL AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`),
// jeder Schritt über HTTP mit fiktiven Testkonten. Die Haltbarkeit über einen Neustart misst
// `tastenkuerzel-pg.integration.test.ts` gegen PostgreSQL.
//
//   S1 · K6/K8  Ab Werk ist jede Aktion unbelegt (Standard); Festlegen, Ändern, Entfernen, eine
//               Aktion auf Standard und alle auf Standard — jeweils bestätigt zurückgemeldet.
//   S2 · K7/K8  Eine neue Anmeldung (Neuladen, zweites Gerät) liest dieselbe Belegung; entfernt
//               bleibt entfernt. Ein zweites Konto bleibt unbeeinflusst.
//   S3 · K14    Doppelbelegung → 409 mit der belegenden Aktion; ungültige Kombinationen → 400. In
//               beiden Fällen bleibt der gespeicherte Stand unverändert.
//   S4 · K4     Rechte: fremde Kennung → 403, ohne Anmeldung 401; jede Rolle darf ihre eigenen Kürzel.
//   S5 · K3     Das Assistenzprofil bleibt unberührt: Profiländerung lässt die Kürzel stehen, ein
//               Kürzelwechsel lässt die Profilfassung stehen (kein 409 im Profilformular).
//   S6 · K4     Prüfprotokoll: die Änderung als Ereignis, ohne Kombination.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { ASSISTENZ_TASTENKUERZEL_GEAENDERT } from "../../services/app/src/routes/assistenz-profil-routes";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };

const BASIS = "/api/me/assistenz/tastenkuerzel";

interface Kombi {
  code: string;
  taste: string;
  strg: boolean;
  alt: boolean;
  umschalt: boolean;
  meta: boolean;
}

interface Stand {
  aktionen: { aktion: string; belegung: Kombi | null; quelle: string }[];
  geaendertAm: string | null;
}

const STRG_UMSCHALT_E: Kombi = {
  code: "KeyE",
  taste: "E",
  strg: true,
  alt: false,
  umschalt: true,
  meta: false,
};
const BEFEHL_UMSCHALT_U: Kombi = {
  code: "KeyU",
  taste: "U",
  strg: false,
  alt: false,
  umschalt: true,
  meta: true,
};

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

const auf = (wer: string, methode: "GET" | "PUT", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function lies(wer: string): Promise<Stand> {
  const r = await auf(wer, "GET", BASIS);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Stand;
}

async function setze(wer: string, rumpf: Record<string, unknown>): Promise<Stand> {
  const r = await auf(wer, "PUT", BASIS, rumpf);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Stand;
}

function von(s: Stand, aktion: string) {
  const e = s.aktionen.find((a) => a.aktion === aktion);
  if (!e) {
    throw new Error(`${aktion} fehlt`);
  }
  return e;
}

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@kuerzel.test", password: "secret123" },
  });
  const adminToken = await anmelden("ada@kuerzel.test");
  erik = await konto(adminToken, "experte", "erik@kuerzel.test", "Erik Experte");
  vera = await konto(adminToken, "viewer", "vera@kuerzel.test", "Vera Viewer");
});

describe("S1 · K6/K8 — Standard, Festlegen, Ändern, Entfernen, Zurücksetzen", () => {
  it("ab Werk unbelegt; jede Änderung wird bestätigt zurückgemeldet", async () => {
    const start = await lies(erik.token);
    expect(start.aktionen.map((a) => a.aktion)).toEqual([
      "oeffnen",
      "seitenhilfe",
      "diktieren",
      "auftragSprechen",
      "aufnahmeStoppen",
      "vorlesenStoppen",
      "suchen",
    ]);
    expect(start.aktionen.every((a) => a.belegung === null && a.quelle === "standard")).toBe(true);
    expect(start.geaendertAm).toBeNull();

    // Festlegen
    let s = await setze(erik.token, { aktion: "oeffnen", belegung: STRG_UMSCHALT_E });
    expect(von(s, "oeffnen")).toEqual({
      aktion: "oeffnen",
      belegung: STRG_UMSCHALT_E,
      quelle: "eigen",
    });
    // Ändern: die alte Kombination ist danach frei
    s = await setze(erik.token, { aktion: "oeffnen", belegung: BEFEHL_UMSCHALT_U });
    expect(von(s, "oeffnen").belegung).toEqual(BEFEHL_UMSCHALT_U);
    s = await setze(erik.token, { aktion: "diktieren", belegung: STRG_UMSCHALT_E });
    expect(von(s, "diktieren").belegung).toEqual(STRG_UMSCHALT_E);
    // Entfernen
    s = await setze(erik.token, { aktion: "oeffnen", belegung: null });
    expect(von(s, "oeffnen")).toMatchObject({ belegung: null, quelle: "entfernt" });
    expect((await lies(erik.token)).aktionen.find((a) => a.aktion === "oeffnen")?.quelle).toBe(
      "entfernt",
    );
    // Eine Aktion auf Standard
    s = await setze(erik.token, { aktion: "oeffnen", belegung: "standard" });
    expect(von(s, "oeffnen")).toMatchObject({ belegung: null, quelle: "standard" });
    expect(von(s, "diktieren").quelle).toBe("eigen");
    // Alle auf Standard
    s = await setze(erik.token, { alleZuruecksetzen: true });
    expect(s.aktionen.every((a) => a.belegung === null && a.quelle === "standard")).toBe(true);
    expect(s.geaendertAm).not.toBeNull();
  });
});

describe("S2 · K7/K8 — über Anmeldung hinweg, je Konto", () => {
  it("neue Anmeldung liest dieselbe Belegung; entfernt bleibt entfernt; Vera unberührt", async () => {
    await setze(erik.token, { aktion: "diktieren", belegung: STRG_UMSCHALT_E });
    await setze(erik.token, { aktion: "oeffnen", belegung: BEFEHL_UMSCHALT_U });
    await setze(erik.token, { aktion: "oeffnen", belegung: null });
    const zweite = await anmelden("erik@kuerzel.test");
    expect(zweite).not.toBe(erik.token);
    const s = await lies(zweite);
    expect(von(s, "diktieren").belegung).toEqual(STRG_UMSCHALT_E);
    expect(von(s, "oeffnen")).toMatchObject({ belegung: null, quelle: "entfernt" });
    const v = await lies(vera.token);
    expect(v.aktionen.every((a) => a.quelle === "standard")).toBe(true);
    // Vera darf dieselbe Kombination für sich belegen — Kürzel sind persönlich.
    await setze(vera.token, { aktion: "oeffnen", belegung: STRG_UMSCHALT_E });
    expect(von(await lies(zweite), "oeffnen").quelle).toBe("entfernt");
  });
});

describe("S3 · K14 — Doppelbelegung und ungültige Kombinationen", () => {
  it("dieselbe Kombination für eine zweite Aktion → 409, nichts geändert", async () => {
    await setze(erik.token, { aktion: "oeffnen", belegung: STRG_UMSCHALT_E });
    const vorher = await lies(erik.token);
    const r = await auf(erik.token, "PUT", BASIS, {
      aktion: "seitenhilfe",
      belegung: STRG_UMSCHALT_E,
    });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ grund: "doppelt", belegtVon: "oeffnen" });
    expect(await lies(erik.token)).toEqual(vorher);
  });

  it("ungültige Aktion oder Kombination → 400, nichts gespeichert", async () => {
    const faelle: Record<string, unknown>[] = [
      { aktion: "gibt-es-nicht", belegung: null },
      { aktion: "oeffnen", belegung: { ...STRG_UMSCHALT_E, strg: false } },
      { aktion: "oeffnen", belegung: { ...STRG_UMSCHALT_E, alt: true } },
      { aktion: "oeffnen", belegung: { ...STRG_UMSCHALT_E, code: "Enter" } },
      { aktion: "oeffnen", belegung: { ...STRG_UMSCHALT_E, taste: "" } },
      { aktion: "oeffnen", belegung: { ...STRG_UMSCHALT_E, meta: "ja" } },
      { aktion: "oeffnen", belegung: "irgendwas" },
      {},
    ];
    for (const rumpf of faelle) {
      const r = await auf(erik.token, "PUT", BASIS, rumpf);
      expect([JSON.stringify(rumpf), r.statusCode]).toEqual([JSON.stringify(rumpf), 400]);
    }
    const s = await lies(erik.token);
    expect(s.aktionen.every((a) => a.quelle === "standard")).toBe(true);
    expect(s.geaendertAm).toBeNull();
  });
});

describe("S4 · K4 — Rechte", () => {
  it("fremde Kennung in Rumpf oder Adresse → 403, nichts geändert", async () => {
    await setze(vera.token, { aktion: "oeffnen", belegung: STRG_UMSCHALT_E });
    const rumpf = await auf(erik.token, "PUT", BASIS, {
      aktion: "oeffnen",
      belegung: null,
      kontoId: vera.id,
    });
    expect(rumpf.statusCode).toBe(403);
    expect((await auf(erik.token, "GET", `${BASIS}?kontoId=${vera.id}`)).statusCode).toBe(403);
    expect(von(await lies(vera.token), "oeffnen").belegung).toEqual(STRG_UMSCHALT_E);
    expect((await lies(erik.token)).aktionen.every((a) => a.quelle === "standard")).toBe(true);
  });

  it("ohne Anmeldung 401", async () => {
    expect((await auf("", "GET", BASIS)).statusCode).toBe(401);
    expect((await auf("", "PUT", BASIS, { aktion: "oeffnen", belegung: null })).statusCode).toBe(
      401,
    );
  });

  it("auch die Leserolle verwaltet ihre eigenen Kürzel", async () => {
    const s = await setze(vera.token, { aktion: "diktieren", belegung: BEFEHL_UMSCHALT_U });
    expect(von(s, "diktieren").quelle).toBe("eigen");
  });
});

describe("S5 · K3 — das Assistenzprofil bleibt unberührt", () => {
  it("Profiländerung lässt die Kürzel stehen; Kürzelwechsel lässt die Profilfassung stehen", async () => {
    const eingerichtet = await auf(erik.token, "PUT", "/api/me/assistenz", {
      name: "Mia",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(eingerichtet.statusCode, eingerichtet.body).toBe(200);
    await setze(erik.token, { aktion: "oeffnen", belegung: STRG_UMSCHALT_E });
    const geaendert = await auf(erik.token, "PUT", "/api/me/assistenz", {
      name: "Mia 2",
      fassung: 1,
    });
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    expect((geaendert.json() as { profil: { fassung: number } }).profil.fassung).toBe(2);
    expect(von(await lies(erik.token), "oeffnen").belegung).toEqual(STRG_UMSCHALT_E);
    // Ohne eingerichtetes Profil entsteht durch die Kürzel kein Profil.
    await setze(vera.token, { aktion: "oeffnen", belegung: STRG_UMSCHALT_E });
    const veraProfil = await auf(vera.token, "GET", "/api/me/assistenz");
    expect(veraProfil.json()).toEqual({ profil: null, einrichtungOffen: true });
    // Und der Unterstützungsmodus bleibt daneben unverändert.
    const modus = await app.inject({
      method: "PUT",
      url: "/api/me/assistenz/eigeninitiative",
      headers: { authorization: `Bearer ${erik.token}` },
      payload: { modus: "hinweise" },
    });
    expect(modus.statusCode).toBe(200);
    expect(von(await lies(erik.token), "oeffnen").belegung).toEqual(STRG_UMSCHALT_E);
  });
});

describe("S6 · K4 — Prüfprotokoll", () => {
  it("die Änderung steht als Ereignis da; die Kombination nicht", async () => {
    await setze(erik.token, {
      aktion: "oeffnen",
      belegung: { ...STRG_UMSCHALT_E, taste: "Ä" },
    });
    const ereignisse = await services.audit.list({ action: ASSISTENZ_TASTENKUERZEL_GEAENDERT });
    expect(ereignisse.map((e) => e.actor)).toEqual([erik.id]);
    const alle = JSON.stringify(await services.audit.list({}));
    expect(alle).not.toContain("KeyE");
  });
});

describe("J · Suchaufruf in derselben Kontoablage", () => {
  it("bleibt standardmäßig unbelegt, ist kontogebunden und lässt sich entfernen", async () => {
    expect(von(await lies(erik.token), "suchen").belegung).toBeNull();
    const gesetzt = await setze(erik.token, { aktion: "suchen", belegung: BEFEHL_UMSCHALT_U });
    expect(von(gesetzt, "suchen").belegung).toEqual(BEFEHL_UMSCHALT_U);
    expect(von(await lies(vera.token), "suchen").belegung).toBeNull();
    expect(von(await lies(await anmelden("erik@kuerzel.test")), "suchen").belegung).toEqual(
      BEFEHL_UMSCHALT_U,
    );
    const entfernt = await setze(erik.token, { aktion: "suchen", belegung: null });
    expect(von(entfernt, "suchen")).toEqual({
      aktion: "suchen",
      belegung: null,
      quelle: "entfernt",
    });
  });
});
