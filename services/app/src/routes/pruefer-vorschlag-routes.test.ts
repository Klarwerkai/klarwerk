// ================================================================================================
// R-0265 — PRÜFER-VORSCHLAG AM DRAHT: `GET /api/validation/reviewer-suggestions`.
// ================================================================================================
//
// Der Vorschlag nennt Personen mit einem Grund („schreibt zum Thema", „hat zum Thema geprüft",
// „nah im Wissensnetz"). Schon der Grund ist eine Auskunft über Objekte — deshalb misst diese Datei
// neben den drei Signalen vor allem die Sichtbarkeitsgrenze: ein vertrauliches Objekt, das der
// Fragende nicht sehen darf, trägt keinen Vorschlag und ist als Zielobjekt nicht da (404).
//
// Bauart wie `validation-routes.test.ts`: der erste registrierte Nutzer ist Admin; die beiden
// Experten tragen `ko.create`, aber nicht `ko.validate` — sie sehen fremde vertrauliche Objekte nicht.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PASSWORT = "geheim12345";

async function login(app: App, email: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASSWORT },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@r0265.test", password: PASSWORT },
  });
  const admin = await login(app, "ada@r0265.test");
  for (const [name, email] of [
    ["Erik", "erik@r0265.test"],
    ["Fiona", "fiona@r0265.test"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: PASSWORT, role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${name} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  const users = await services.auth.listUsers();
  const id = (email: string): string => {
    const u = users.find((x) => x.email === email);
    if (!u) {
      throw new Error(`Konto ${email} fehlt`);
    }
    return u.id;
  };
  return {
    services,
    app,
    erik: await login(app, "erik@r0265.test"),
    ids: {
      ada: id("ada@r0265.test"),
      erik: id("erik@r0265.test"),
      fiona: id("fiona@r0265.test"),
    },
  };
}

function ko(
  author: string,
  category: string,
  confidentiality: "intern" | "vertraulich" = "intern",
  tags: string[] = [],
) {
  return {
    title: `${category} von ${author}`,
    statement: "Inhalt.",
    type: "best_practice" as const,
    category,
    tags,
    author,
    neededValidations: 3,
    confidentiality,
  };
}

async function vorschlag(app: App, auth: Auth, query: string) {
  return app.inject({
    method: "GET",
    url: `/api/validation/reviewer-suggestions${query}`,
    headers: auth,
  });
}

describe("R-0265 · GET /api/validation/reviewer-suggestions", () => {
  it("R1 · ein fremdes vertrauliches Objekt trägt keinen Vorschlag", async () => {
    const { services, app, erik, ids } = await setup();
    await services.ko.create(ko(ids.ada, "Hydraulik", "vertraulich"));

    const res = await vorschlag(app, erik, "?category=Hydraulik");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    await app.close();
  });

  it("R2 · Autorenschaft und frühere Prüfung tragen; der Fragende selbst fehlt", async () => {
    const { services, app, erik, ids } = await setup();
    const vonAda = await services.ko.create(ko(ids.ada, "Hydraulik"));
    await services.ko.create(ko(ids.erik, "Hydraulik"));
    await services.validation.rate(vonAda.id, ids.fiona, "up");

    const res = await vorschlag(app, erik, "?category=hydraulik");
    expect(res.statusCode).toBe(200);
    const v = res.json() as { userId: string; gruende: string[] }[];
    expect(v.map((s) => [s.userId, s.gruende])).toEqual(
      [
        [ids.ada, ["autorschaft"]],
        [ids.fiona, ["pruefungen"]],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
    expect(v.some((s) => s.userId === ids.erik)).toBe(false);
    await app.close();
  });

  it("R3 · ein vertrauliches Zielobjekt, das der Fragende nicht sieht, ist nicht da (404)", async () => {
    const { services, app, erik, ids } = await setup();
    const geheim = await services.ko.create(ko(ids.ada, "Hydraulik", "vertraulich"));

    const res = await vorschlag(app, erik, `?koId=${encodeURIComponent(geheim.id)}`);
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("R4 · Netznähe am vorhandenen Objekt: der Autor des Nachbarn, nicht der eigene Autor", async () => {
    const { services, app, erik, ids } = await setup();
    const ziel = await services.ko.create(ko(ids.fiona, "Hydraulik"));
    const nachbar = await services.ko.create(ko(ids.ada, "Elektrik"));
    await services.kanten.setze({
      id: "k-r0265",
      quelleId: ziel.id,
      zielId: nachbar.id,
      art: "ergaenzt",
      richtung: "ungerichtet",
      urheber: ids.fiona,
      gesetztAm: "2026-10-01T00:00:00.000Z",
      geaendertAm: "2026-10-01T00:00:00.000Z",
      status: "aktiv",
      version: 1,
    });

    const res = await vorschlag(app, erik, `?koId=${encodeURIComponent(ziel.id)}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ userId: ids.ada, punkte: 3, gruende: ["netznaehe"] }]);
    await app.close();
  });

  it("R5 · ohne Kategorie und ohne Schlagwort gibt es keinen Vorschlag", async () => {
    const { services, app, erik, ids } = await setup();
    await services.ko.create(ko(ids.ada, "Hydraulik"));

    const res = await vorschlag(app, erik, "");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    await app.close();
  });

  it("R6 · gemeinsames Schlagwort genügt als Thema", async () => {
    const { services, app, erik, ids } = await setup();
    await services.ko.create(ko(ids.ada, "Wartung", "intern", ["Ventil"]));

    const res = await vorschlag(app, erik, "?tags=ventil,druck");
    expect(res.statusCode).toBe(200);
    expect((res.json() as { userId: string }[]).map((s) => s.userId)).toEqual([ids.ada]);
    await app.close();
  });
});
