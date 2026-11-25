import { expect } from "vitest";
import type { AppServices, buildApp } from "../../services/app/src/build-app";
import type { TeamFassung } from "../../services/app/src/teams";

export function anfrage(app: ReturnType<typeof buildApp>, token: string) {
  return (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload ? { payload } : {}),
    });
}

export async function fachbereich(s: AppServices, app: ReturnType<typeof buildApp>) {
  const adminDaten = { name: "Ada", email: "ada@team.test", password: "synthetisch123" };
  const registriert = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: adminDaten,
  });
  expect(registriert.statusCode, registriert.body).toBe(201);
  async function einloggen(email: string) {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: adminDaten.password },
    });
    expect(r.statusCode, r.body).toBe(200);
    return r.json<{ token: string }>().token;
  }
  const verwaltung = anfrage(app, await einloggen(adminDaten.email));
  async function konto(name: string, role: string) {
    const email = `${name}@team.test`;
    const r = await verwaltung("POST", "/api/users", {
      name,
      email,
      role,
      password: adminDaten.password,
    });
    expect(r.statusCode, r.body).toBe(201);
    const user = (await s.auth.listUsers()).find((u) => u.email === email);
    if (!user) throw new Error("Testkonto fehlt.");
    return { id: user.id, token: await einloggen(email) };
  }
  const autor = await konto("autorin", "experte");
  const leser = await konto("leser", "viewer");
  const fremd = await konto("fremd", "experte");
  const zeit = new Date().toISOString();
  const team: TeamFassung = {
    id: "team-einkauf",
    name: "Einkauf",
    zweck: "Beschaffung",
    verantwortlich: autor.id,
    mitglieder: [autor.id, leser.id],
    version: 1,
    archiviert: false,
    vorgang: "angelegt",
    angelegtVon: autor.id,
    angelegtAm: zeit,
    geaendertVon: autor.id,
    geaendertAm: zeit,
  };
  expect(await s.teams.lege(team)).toBe(true);
  const aussage = "Guest Wi-Fi must not provide access to the internal staff network.";
  const gegen = "Guest Wi-Fi must provide access to the internal staff network.";
  const ko = await s.ko.create({
    title: "Guest Wi-Fi",
    statement: aussage,
    type: "technik",
    category: "Netze",
    author: autor.id,
    confidentiality: "intern",
  });
  await s.ko.setValidationState(ko.id, { trust: 90, status: "validiert" });
  const definition = {
    name: "Netzfragen",
    aufgabe: "Prüfe die Anforderungen an das Gastnetz.",
    quellen: [ko.id],
    beispiele: [
      { frage: aussage, erwartet: "belegt" },
      { frage: gegen, erwartet: "widerspruch" },
      { frage: "How many trees grow in Oslo?", erwartet: "offen" },
    ],
  };
  const api = "/api/teamassistenten";
  const alsAutor = anfrage(app, autor.token);
  const neu = await alsAutor("POST", api, { teamId: team.id, definition });
  expect(neu.statusCode, neu.body).toBe(201);
  const id = neu.json<{ id: string }>().id;
  return { autor, leser, fremd, team, aussage, ko, definition, api, id, pfad: `${api}/${id}` };
}
