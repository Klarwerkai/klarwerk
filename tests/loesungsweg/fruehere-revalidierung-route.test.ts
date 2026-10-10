// R-1662 · Prüfpunkt 6 „Gibt es alte Revalidierungsfälle?" — FRÜHERE Bestätigungen (Ben, Nacharbeit 5).
//
// Nach „stimmt noch" löscht `confirmStillValid` den offenen Merker und schreibt `ko.revalidated` ins
// Prüfprotokoll (services/lifecycle/src/service.ts:118-131). `GET /api/lifecycle/pending` kennt den
// Fall danach nicht mehr; `GET /api/lifecycle/revalidiert?ko=…` liest den Beleg — mit `ko.read`,
// Zeilenrecht `sichtbareEintraege` und nur Kennung, Zeitpunkt und Fassung.
// Gemessen an der echten Route hinter `buildApp`: offener Fall über Anlagenkopplung und
// Anlagenänderung, Bestätigung über den KO-Dispatcher (`action: "revalidate"`).
// Anlage, Rollen und Vertraulichkeit wie `tests/security/mega74-nebenwege-vertraulich.test.ts`.
//
// GRENZE: In-Memory-Ablage (`buildServices()`), keine Postgres-Messung.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function login(app: App, email: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@r1662rv.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@r1662rv.test");
  for (const [email, role] of [
    ["viewer@r1662rv.test", "viewer"],
    ["autor@r1662rv.test", "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    expect(res.statusCode, res.body).toBe(201);
  }
  return {
    app,
    admin,
    autor: await login(app, "autor@r1662rv.test"),
    viewer: await login(app, "viewer@r1662rv.test"),
  };
}

async function ko(app: App, autor: Auth, titel: string, vertraulich = false): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} — Druck an Maschine 4 prüfen.`,
      type: "best_practice",
      category: "Anlage 4",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().id as string;
  if (vertraulich) {
    const up = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(up.statusCode, up.body).toBe(200);
  }
  return id;
}

/** Ein offener Revalidierungsfall: Objekt an eine Anlage koppeln, die Anlage ändert sich. */
async function offenerFall(app: App, autor: Auth, kurator: Auth, koId: string, anlage: string) {
  const gekoppelt = await app.inject({
    method: "POST",
    url: "/api/lifecycle/couple",
    headers: autor,
    payload: { assetRef: anlage, koId },
  });
  expect(gekoppelt.statusCode, gekoppelt.body).toBe(204);
  const geaendert = await app.inject({
    method: "POST",
    url: "/api/lifecycle/asset-changed",
    headers: kurator,
    payload: { assetRef: anlage },
  });
  expect(geaendert.statusCode, geaendert.body).toBe(200);
}

async function bestaetigen(app: App, autor: Auth, koId: string): Promise<number> {
  // produkt:20261010:aenderungsfolgen-sichtbar (Nacharbeit 4): eine offene Folgeprüfung wird nur
  // mit ihrem angezeigten Stand abgeschlossen — derselbe Weg wie im Reiter „Erneut".
  const uebersicht = await app.inject({
    method: "GET",
    url: "/api/lifecycle/folgepruefung",
    headers: autor,
  });
  expect(uebersicht.statusCode, uebersicht.body).toBe(200);
  const stand = (uebersicht.json() as { koId: string; stand: number }[]).find(
    (f) => f.koId === koId,
  )?.stand;
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: autor,
    payload: stand === undefined ? { action: "revalidate" } : { action: "revalidate", stand },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().version as number;
}

async function offen(app: App, headers: Auth): Promise<string[]> {
  const res = await app.inject({ method: "GET", url: "/api/lifecycle/pending", headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as string[];
}

async function frueher(app: App, headers: Auth, ids: string[]) {
  const res = await app.inject({
    method: "GET",
    url: `/api/lifecycle/revalidiert?ko=${ids.join(",")}`,
    headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Record<string, unknown>[];
}

describe("R-1662 · GET /api/lifecycle/revalidiert — frühere Revalidierungen", () => {
  it("R1 · nach der Bestätigung ist der Fall nicht mehr offen, aber als frühere Bestätigung da", async () => {
    const { app, admin, autor, viewer } = await setup();
    const id = await ko(app, autor, "Druckspeicher prüfen");
    await offenerFall(app, autor, admin, id, "Maschine-4");

    // Vorher: offen, noch nie bestätigt.
    expect(await offen(app, viewer)).toContain(id);
    expect(await frueher(app, viewer, [id])).toEqual([]);

    const version = await bestaetigen(app, autor, id);

    // Nachher: der Merker ist weg — genau deshalb braucht es den zweiten Leseweg.
    expect(await offen(app, viewer)).not.toContain(id);
    const belege = await frueher(app, viewer, [id]);
    expect(belege).toHaveLength(1);
    expect(belege[0]).toMatchObject({ koId: id, version });
    expect(typeof belege[0]?.am).toBe("string");
  });

  it("R2 · Feldbeschränkung: nur Kennung, Zeitpunkt und Fassung — kein Akteur, keine Nutzlast", async () => {
    const { app, admin, autor, viewer } = await setup();
    const id = await ko(app, autor, "Ventil V4");
    await offenerFall(app, autor, admin, id, "Ventil-4");
    await bestaetigen(app, autor, id);

    const [beleg] = await frueher(app, viewer, [id]);
    expect(Object.keys(beleg ?? {}).sort()).toEqual(["am", "koId", "version"]);
  });

  it("R3 · mehrere Bestätigungen: alle, die jüngste zuerst; fremde Objekte nicht", async () => {
    const { app, admin, autor, viewer } = await setup();
    const id = await ko(app, autor, "Dichtung prüfen");
    const fremd = await ko(app, autor, "Fremdes Objekt");
    await offenerFall(app, autor, admin, id, "Dichtung-1");
    const v1 = await bestaetigen(app, autor, id);
    await offenerFall(app, autor, admin, id, "Dichtung-2");
    const v2 = await bestaetigen(app, autor, id);
    await offenerFall(app, autor, admin, fremd, "Fremd-1");
    await bestaetigen(app, autor, fremd);

    const belege = await frueher(app, viewer, [id]);
    expect(belege.map((b) => b.version)).toEqual([v2, v1]);
    expect(belege.every((b) => b.koId === id)).toBe(true);
  });

  it("R4 · ein vertrauliches Objekt fehlt für den Betrachter — der Autor sieht seine Bestätigung", async () => {
    const { app, admin, autor, viewer } = await setup();
    const geheim = await ko(app, autor, "Vertraulicher Ablauf", true);
    await offenerFall(app, autor, admin, geheim, "Geheim-1");
    await bestaetigen(app, autor, geheim);

    expect(await frueher(app, viewer, [geheim])).toEqual([]);
    expect((await frueher(app, autor, [geheim])).map((b) => b.koId)).toEqual([geheim]);
  });

  it("R5 · ohne Objekte eine leere Liste, ohne Anmeldung 401", async () => {
    const { app, viewer } = await setup();
    expect(await frueher(app, viewer, [])).toEqual([]);
    const ohne = await app.inject({ method: "GET", url: "/api/lifecycle/revalidiert?ko=k1" });
    expect(ohne.statusCode).toBe(401);
  });
});
