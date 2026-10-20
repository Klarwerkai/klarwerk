import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const services = buildServices();
let app: FastifyInstance;
const kennwort = "fiktiv-gedaechtnis-2026";
let anna = "";
let bert = "";
async function anmelden(email: string): Promise<string> {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: kennwort },
  });
  expect(r.statusCode).toBe(200);
  return r.cookies[0] ? `${r.cookies[0].name}=${r.cookies[0].value}` : "";
}
beforeAll(async () => {
  app = buildApp(services);
  const email = "anna@gedaechtnis.test";
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Anna Fiktiv", email, password: kennwort },
      })
    ).statusCode,
  ).toBe(201);
  const admin = await anmelden(email);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/users",
        headers: { cookie: admin },
        payload: {
          name: "Bert Fiktiv",
          email: "bert@gedaechtnis.test",
          password: kennwort,
          role: "viewer",
        },
      })
    ).statusCode,
  ).toBe(201);
  anna = await anmelden("anna@gedaechtnis.test");
  bert = await anmelden("bert@gedaechtnis.test");
});
afterAll(async () => {
  await app?.close();
});
describe("Klara09 · eigene Präferenzen korrigieren, Herkunft und Rechte behalten", () => {
  it("korrigiert dieselbe Kennung und Herkunft mit CAS; fremd/unbekannt gleich, neue Anmeldung sieht die Korrektur", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/me/gedaechtnis",
      headers: { cookie: anna },
      payload: {
        art: "vorliebe",
        inhalt: "Fiktive kurze Vorliebe",
        darstellung: "kurz",
        aufbewahrungTage: 30,
        kontoId: "bert",
      },
    });
    expect(r.statusCode).toBe(201);
    const e = r.json().eintrag;
    const url = `/api/me/gedaechtnis/${e.id}`;
    const neu = {
      fassung: 1,
      inhalt: "Fiktive ausführliche Vorliebe",
      darstellung: "ausfuehrlich",
      herkunft: { art: "antwort", antwortId: "fremd" },
    };
    const a = await app.inject({ method: "PUT", url, headers: { cookie: anna }, payload: neu });
    expect(a.statusCode).toBe(200);
    expect(a.json().eintrag).toMatchObject({
      id: e.id,
      fassung: 2,
      herkunft: e.herkunft,
      darstellung: "ausfuehrlich",
    });
    for (const id of [e.id, "unbekannt"]) {
      const f = await app.inject({
        method: "PUT",
        url: `/api/me/gedaechtnis/${id}`,
        headers: { cookie: bert },
        payload: neu,
      });
      expect(f.statusCode).toBe(404);
      expect(f.json().message).toBe("Eintrag nicht gefunden.");
    }
    expect(
      (await app.inject({ method: "PUT", url, headers: { cookie: anna }, payload: neu }))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "PUT",
          url,
          headers: { cookie: anna },
          payload: { ...neu, fassung: 2, inhalt: "" },
        })
      ).statusCode,
    ).toBe(400);
    anna = await anmelden("anna@gedaechtnis.test");
    const liste = await app.inject({ url: "/api/me/gedaechtnis", headers: { cookie: anna } });
    expect(liste.json().eintraege).toHaveLength(1);
    expect(liste.json().eintraege[0]).toMatchObject({ inhalt: neu.inhalt, fassung: 2 });
    expect(
      (await app.inject({ url: "/api/me/gedaechtnis", headers: { cookie: bert } })).json()
        .eintraege,
    ).toEqual([]);
    const aud = await services.audit.list();
    expect(JSON.stringify(aud)).not.toContain(neu.inhalt);
    expect(JSON.stringify(aud)).not.toContain("Fiktive kurze Vorliebe");
    expect(
      (await app.inject({ method: "DELETE", url, headers: { cookie: bert } })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "DELETE", url, headers: { cookie: anna } })).statusCode,
    ).toBe(200);
    anna = await anmelden("anna@gedaechtnis.test");
    expect(
      (await app.inject({ url: "/api/me/gedaechtnis", headers: { cookie: anna } })).json()
        .eintraege,
    ).toEqual([]);
  });
  it("ohne Sitzung keine Lesung/Änderung und strukturierte Darstellung nur mit erlaubtem Wert", async () => {
    for (const method of ["GET", "PUT", "DELETE"] as const)
      expect(
        (
          await app.inject({
            method,
            url: method === "GET" ? "/api/me/gedaechtnis" : "/api/me/gedaechtnis/e",
          })
        ).statusCode,
      ).toBe(401);
    const r = await app.inject({
      method: "POST",
      url: "/api/me/gedaechtnis",
      headers: { cookie: anna },
      payload: { art: "vorliebe", inhalt: "Inhalt", darstellung: { toString: "kurz" } },
    });
    expect(r.statusCode).toBe(400);
  });
});
