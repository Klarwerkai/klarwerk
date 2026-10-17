// ================================================================================================
// BPA-01 AC10 / AC03 (aufnahme:20260922:gesamt-browser-kontextkarten, nacharbeit-19) — DIE SITZUNG,
// AN DIE DER BEGLEITER DIE BROWSERKARTE BINDET.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`):
// `GET /api/me/klara/begleiter/sitzung` — die Tür, die der Mac-Begleiter (`Steuerung.swift`,
// `anmeldungPruefen`) aus seiner Webfläche fragt. Der Host bindet die Karte an `{ nutzer, sitzung }`.
//
//   S1  Dieselbe Anmeldung → derselbe Fingerabdruck; das Sitzungsmerkmal selbst kommt nie zurück.
//   S2  Ab- und Neuanmelden DESSELBEN Nutzers → ein ANDERER Fingerabdruck (Befund nacharbeit-19:
//       ein Sitzungswechsel ohne Nutzerwechsel muss unterscheidbar sein).
//   S3  Zwei Konten → zwei Nutzer, zwei Fingerabdrücke; ohne oder mit abgemeldeter Sitzung 401.
import { beforeEach, describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { begleiterSitzung } from "../../services/app/src/routes/klara-begleiter-routes";

type App = ReturnType<typeof buildApp>;

let app: App;
let adminToken = "";

const SITZUNG = "/api/me/klara/begleiter/sitzung";

async function anmelden(email: string): Promise<string> {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(r.statusCode).toBe(200);
  return (r.json() as { token: string }).token;
}

async function sitzung(token: string) {
  return app.inject({
    method: "GET",
    url: SITZUNG,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(async () => {
  app = buildApp(assembleServices(inMemoryRepos()));
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@sitzung.test", password: "secret123" },
  });
  adminToken = await anmelden("ada@sitzung.test");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: "Erik", email: "erik@sitzung.test", password: "secret123", role: "experte" },
  });
  expect(angelegt.statusCode).toBe(201);
});

describe("S1 · dieselbe Anmeldung, derselbe Fingerabdruck — nie das Merkmal", () => {
  it("stabil je Sitzung, ohne Merkmal in der Antwort, nicht zwischenspeicherbar", async () => {
    const token = await anmelden("erik@sitzung.test");
    const eins = await sitzung(token);
    const zwei = await sitzung(token);
    expect(eins.statusCode).toBe(200);
    expect(eins.headers["cache-control"]).toBe("no-store");
    const a = eins.json() as { nutzer: string; sitzung: string };
    const b = zwei.json() as { nutzer: string; sitzung: string };
    expect(a).toEqual(b);
    expect(a.sitzung).toMatch(/^[0-9a-f]{32}$/);
    expect(a.sitzung).toBe(begleiterSitzung(token));
    expect(eins.body).not.toContain(token);
    expect(Object.keys(a).sort()).toEqual(["nutzer", "sitzung"]);
  });
});

describe("S2 · Ab- und Neuanmelden desselben Nutzers ist eine NEUE Sitzung", () => {
  it("gleicher Nutzer, anderer Fingerabdruck; die alte Sitzung gilt nicht mehr", async () => {
    const alt = await anmelden("erik@sitzung.test");
    const vorher = (await sitzung(alt)).json() as { nutzer: string; sitzung: string };
    const ab = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${alt}` },
    });
    expect(ab.statusCode).toBe(204);
    expect((await sitzung(alt)).statusCode).toBe(401);

    const neu = await anmelden("erik@sitzung.test");
    const nachher = (await sitzung(neu)).json() as { nutzer: string; sitzung: string };
    expect(nachher.nutzer).toBe(vorher.nutzer);
    expect(nachher.sitzung).not.toBe(vorher.sitzung);
  });

  it("zwei gleichzeitige Anmeldungen desselben Nutzers sind zwei Sitzungen", async () => {
    const eins = (await sitzung(await anmelden("erik@sitzung.test"))).json() as {
      sitzung: string;
    };
    const zwei = (await sitzung(await anmelden("erik@sitzung.test"))).json() as {
      sitzung: string;
    };
    expect(eins.sitzung).not.toBe(zwei.sitzung);
  });
});

describe("S3 · Konten getrennt; ohne Anmeldung nichts", () => {
  it("zwei Konten, zwei Nutzer; ohne Sitzung 401", async () => {
    const erik = (await sitzung(await anmelden("erik@sitzung.test"))).json() as {
      nutzer: string;
    };
    const ada = (await sitzung(adminToken)).json() as { nutzer: string };
    expect(erik.nutzer).not.toBe(ada.nutzer);
    expect((await sitzung("")).statusCode).toBe(401);
    expect((await sitzung("erfunden")).statusCode).toBe(401);
  });
});
