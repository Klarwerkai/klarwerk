// R-1662 · Prüfpunkt 5 „Gibt es offene oder gelöste Konflikte?" — der Leseweg für GELÖSTE Konflikte.
//
// `GET /api/conflicts` führt nur offene (`conflicts.unresolved()` filtert `geloest` hart weg). Für
// den Lösungsweg an einer Antwort gibt es deshalb `GET /api/conflicts/geloest?ko=<id>,<id>`: die von
// einem Menschen entschiedenen oder als Fehlalarm geschlossenen Konflikte zu genau diesen Objekten,
// mit demselben Paar-Tor wie die Liste. Gemessen an der echten Route hinter `buildApp`.
// Anlage, Rollen und Vertraulichkeit sind aus `tests/security/mega74-nebenwege-vertraulich.test.ts`
// übernommen, das Entscheiden aus `tests/konflikt-vermerk-am-endpunkt/…` (H1/H4).
//
// GRENZE: In-Memory-Ablage (`buildServices()`), keine Postgres-Messung.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Conflict } from "../../services/conflicts";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const GEHEIM = "Der geheime Kern, den ein Betrachter nie lesen darf.";

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
    payload: { name: "Admin", email: "admin@r1662.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@r1662.test");
  for (const [email, role] of [
    ["viewer@r1662.test", "viewer"],
    ["autor@r1662.test", "experte"],
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
    autor: await login(app, "autor@r1662.test"),
    viewer: await login(app, "viewer@r1662.test"),
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
      statement: vertraulich ? GEHEIM : `${titel} — gewöhnlicher interner Inhalt.`,
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

// Kontextkonflikt: seit R-0215 wird ein Wahrheitskonflikt erst nach der Eskalation entschieden
// (`tests/konfliktklassifikation/klassifikation-und-eskalation.test.ts`); ein Kontextkonflikt geht
// direkt. Für diese Route zählt nur, DASS ein Mensch entschieden hat.
async function konflikt(app: App, kurator: Auth, koA: string, koB: string): Promise<Conflict> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${koA}`,
    headers: kurator,
    payload: {
      action: "conflict",
      conflict: { koA, koB, type: "context", description: "Die Druckangaben widersprechen sich." },
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as Conflict;
}

async function entscheiden(
  app: App,
  kurator: Auth,
  k: Conflict,
  decision: string,
  vorrang?: unknown,
): Promise<void> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${k.koA}`,
    headers: kurator,
    payload: {
      action: "resolve-conflict",
      conflictId: k.id,
      decision,
      ...(vorrang === undefined ? {} : { vorrang }),
    },
  });
  expect(res.statusCode, res.body).toBe(200);
}

async function geloest(app: App, headers: Auth, ids: string[]): Promise<Conflict[]> {
  const res = await app.inject({
    method: "GET",
    url: `/api/conflicts/geloest?ko=${ids.join(",")}`,
    headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Conflict[];
}

describe("R-1662 · GET /api/conflicts/geloest", () => {
  it("G1 · ein entschiedener Konflikt einer Quelle kommt mit Entscheidung beim Betrachter an", async () => {
    const { app, admin, autor, viewer } = await setup();
    const a = await ko(app, autor, "Druckspeicher prüfen");
    const b = await ko(app, autor, "Druck nach 20 Minuten nachregeln");
    const k = await konflikt(app, admin, a, b);
    await entscheiden(app, admin, k, "Druckspeicher zuerst; Nachregeln nur bei Baureihe 3.");

    const antwort = await geloest(app, viewer, [a]);
    expect(antwort.map((c) => c.id)).toEqual([k.id]);
    expect(antwort[0]?.decision).toBe("Druckspeicher zuerst; Nachregeln nur bei Baureihe 3.");
    expect(antwort[0]?.resolutionReason).toBe("decided");
    // Dieselbe Auskunft über die Gegenseite.
    expect((await geloest(app, viewer, [b])).map((c) => c.id)).toEqual([k.id]);
  });

  it("G2 · ein OFFENER Konflikt und ein Konflikt fremder Objekte stehen nicht darin", async () => {
    const { app, admin, autor, viewer } = await setup();
    const a = await ko(app, autor, "Quelle der Antwort");
    const b = await ko(app, autor, "Gegenpol");
    const x = await ko(app, autor, "Fremd X");
    const y = await ko(app, autor, "Fremd Y");
    await konflikt(app, admin, a, b);
    const fremd = await konflikt(app, admin, x, y);
    await entscheiden(app, admin, fremd, "X gilt.");

    expect(await geloest(app, viewer, [a])).toEqual([]);
    // Kalibrierung: der fremde gelöste Konflikt ist da — nur nicht für diese Quelle.
    expect((await geloest(app, viewer, [x])).map((c) => c.id)).toEqual([fremd.id]);
  });

  it("G3 · ein Fehlalarm kommt als „dismissed“ an", async () => {
    const { app, admin, autor, viewer } = await setup();
    const a = await ko(app, autor, "Fehlalarm A");
    const b = await ko(app, autor, "Fehlalarm B");
    const k = await konflikt(app, admin, a, b);
    const res = await app.inject({
      method: "POST",
      url: `/api/conflicts/${k.id}/dismiss`,
      headers: admin,
      payload: { note: "Andere Anlage." },
    });
    expect(res.statusCode, res.body).toBe(200);

    const antwort = await geloest(app, viewer, [a]);
    expect(antwort.map((c) => c.resolutionReason)).toEqual(["dismissed"]);
  });

  it("G4 · ein gelöster Konflikt mit einem vertraulichen Objekt bleibt dem Betrachter verborgen", async () => {
    const { app, admin, autor, viewer } = await setup();
    const geheim = await ko(app, autor, "Vertraulicher Streitpunkt", true);
    const offen = await ko(app, autor, "Interner Gegenpol");
    const k = await konflikt(app, admin, geheim, offen);
    await entscheiden(app, admin, k, `Entschieden nach: ${GEHEIM}`);

    const res = await app.inject({
      method: "GET",
      url: `/api/conflicts/geloest?ko=${offen}`,
      headers: viewer,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(GEHEIM);
    expect(res.json()).toEqual([]);
    // Gegenprobe: der Autor beider Objekte sieht denselben Konflikt.
    expect((await geloest(app, autor, [offen])).map((c) => c.id)).toEqual([k.id]);
  });

  // Integration mit R-0263 (main fb69d51d): entschiedene Konflikte tragen jetzt `vorrang`. Bei
  // sichtbarem Paar kommt er vollständig an; die Route leert seinen Geltungsbereich nur bei Redaktion.
  it("G6 · ein festgelegter Vorrang kommt mit Geltungsbereich beim Betrachter an", async () => {
    const { app, admin, autor, viewer } = await setup();
    const allgemein = await ko(app, autor, "Druck allgemein");
    const speziell = await ko(app, autor, "Druck Baureihe 3");
    const k = await konflikt(app, admin, allgemein, speziell);
    await entscheiden(app, admin, k, "Baureihe 3 ist der Sonderfall.", {
      art: "schraenkt_ein",
      gilt: speziell,
      geltungsbereich: "Baureihe 3",
    });

    const [geliefert] = await geloest(app, viewer, [allgemein]);
    expect(geliefert?.id).toBe(k.id);
    expect(geliefert?.vorrang).toMatchObject({
      art: "schraenkt_ein",
      vorrangKo: speziell,
      nachrangKo: allgemein,
      geltungsbereich: "Baureihe 3",
    });
  });

  it("G5 · ohne Objekte eine leere Liste, ohne Anmeldung 401", async () => {
    const { app, viewer } = await setup();
    expect(await geloest(app, viewer, [])).toEqual([]);
    const ohne = await app.inject({ method: "GET", url: "/api/conflicts/geloest?ko=k1" });
    expect(ohne.statusCode).toBe(401);
  });
});
