// ================================================================================================
// AUFTRAG-mega74 BLOCK B — DER HAUPTLESEPFAD SETZT DIE VERTRAULICHKEIT DURCH.
// ================================================================================================
//
// DER BEFUND, den dieser Test beim ERSTEN Lauf selbst geliefert hat (rot zuerst): bis mega74
// forderte `GET /api/kos/:id` (ko-routes.ts:334-345) nur `ko.read` und gab danach ALLES heraus —
// unabhängig von der Stufe. Der Code vermerkte das selbst als „die ehrliche Grenze aus mega45"
// (library-routes.ts:386-388). Dieselbe Lage bei `:id/versions`, `:id/evidence` und der
// Bibliothekssuche. Die EGRESS-Wege (Export, Herkunftskette, Nachbarschaft, KI) setzten die
// SCRUM-506-Regel dagegen seit Langem durch — es gab also zwei Welten, und die Lesewelt war offen.
//
// DIE REGEL (Pedis Variante A, entschieden am 30.07.): dieselbe SCRUM-506-Regel gilt ab jetzt auf
// JEDEM Leseweg, erweitert um den Autor — `darfSehen` in services/app/src/sichtbarkeit.ts.
//
// WARUM 404 UND NICHT 403: ein 403 verrät, dass das Objekt existiert. Bei einem vertraulichen
// Objekt ist schon die Existenz eine Auskunft. Fail-closed heißt hier: es sieht aus, als gäbe es
// das Objekt nicht.
//
// GEGENPROBE, ohne die dieser Test wertlos wäre: Controller, Admin UND der Autor sehen es
// weiterhin. Ohne die Autor-Ausnahme könnte ein Experte ein vertrauliches Objekt erfassen und es
// danach nicht mehr öffnen (dieselbe Ausnahme trägt bereits das Löschen, ko-routes.ts:1019).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

// Die Vorrichtung legt ihre Konten SELBST an (kein Demo-Seed): der erste registrierte Nutzer wird
// Admin, danach legt der Admin die drei Rollen direkt an (POST /api/users, sofort freigegeben).
async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@mega74.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@mega74.test", "geheim12345");

  for (const [email, role] of [
    ["viewer@mega74.test", "viewer"],
    ["autor@mega74.test", "experte"],
    ["fremd@mega74.test", "experte"],
    ["controller@mega74.test", "controller"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} (${role}) nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }

  return {
    app,
    admin,
    viewer: await login(app, "viewer@mega74.test", "geheim12345"),
    autor: await login(app, "autor@mega74.test", "geheim12345"),
    fremd: await login(app, "fremd@mega74.test", "geheim12345"),
    controller: await login(app, "controller@mega74.test", "geheim12345"),
  };
}

// Legt ein KO an und stuft es auf „vertraulich" hoch (Upgrade ist für ko.create frei, SCRUM-509).
async function vertraulichesKo(app: App, autor: Auth, titel = "Vertraulicher Beitrag") {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: titel,
      statement: "Sensibler Kerntext, der einen Betrachter nichts angeht.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().id as string;
  const up = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: autor,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(up.statusCode, up.body).toBe(200);
  expect(up.json().confidentiality).toBe("vertraulich");
  return id;
}

// Ein INTERNES KO als Kalibrierung: bliebe es dem Betrachter ebenfalls verborgen, hätte der Test
// oben nur bewiesen, dass die Route gar nichts mehr herausgibt.
async function internesKo(app: App, autor: Auth) {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: "Internes Alltagswissen",
      statement: "Nichts Geheimes — dieses Objekt muss jeder Betrachter sehen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  return created.json().id as string;
}

describe("mega74 B · vertrauliche Wissensobjekte sind auf JEDEM Leseweg fail-closed", () => {
  it("GET /api/kos/:id — Betrachter bekommt 404, nicht das Objekt und nicht 403", async () => {
    const { app, autor, viewer } = await setup();
    const id = await vertraulichesKo(app, autor);

    const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: viewer });

    expect(
      res.statusCode,
      `Betrachter darf ein vertrauliches KO nicht sehen. Antwort war: ${res.statusCode} ${res.body}`,
    ).toBe(404);
    // Ein 403 wäre schon zu viel: es bestätigt die Existenz.
    expect(res.statusCode).not.toBe(403);
    expect(res.body).not.toContain("Sensibler Kerntext");
  });

  it("GET /api/kos/:id/versions — Betrachter bekommt 404 (Versionen tragen den Inhalt mit)", async () => {
    const { app, autor, viewer } = await setup();
    const id = await vertraulichesKo(app, autor);

    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${id}/versions`,
      headers: viewer,
    });

    expect(res.statusCode, `Antwort war: ${res.statusCode} ${res.body}`).toBe(404);
    expect(res.body).not.toContain("Sensibler Kerntext");
  });

  it("GET /api/kos/:id/evidence — Betrachter bekommt 404 (Belegzitate sind Inhalt)", async () => {
    const { app, autor, viewer } = await setup();
    const id = await vertraulichesKo(app, autor);

    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${id}/evidence`,
      headers: viewer,
    });

    expect(res.statusCode, `Antwort war: ${res.statusCode} ${res.body}`).toBe(404);
  });

  it("GET /api/kos (Liste) und /api/library/search — das vertrauliche KO fehlt dem Betrachter", async () => {
    const { app, autor, viewer } = await setup();
    const vertraulich = await vertraulichesKo(app, autor);
    const intern = await internesKo(app, autor);

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers: viewer });
    expect(liste.statusCode).toBe(200);
    const ids = (liste.json() as { id: string }[]).map((k) => k.id);
    expect(ids, "das vertrauliche KO darf nicht in der Liste stehen").not.toContain(vertraulich);
    // KALIBRIERUNG: die Liste ist nicht einfach leer.
    expect(ids, "das interne KO MUSS in der Liste stehen").toContain(intern);

    const suche = await app.inject({
      method: "GET",
      url: "/api/library/search?q=",
      headers: viewer,
    });
    expect(suche.statusCode).toBe(200);
    expect(suche.body).not.toContain("Sensibler Kerntext");
    expect(suche.body, "KALIBRIERUNG: die Suche findet weiterhin Internes").toContain(
      "Internes Alltagswissen",
    );
  });

  it("GEGENPROBE — Controller, Admin UND der Autor sehen es weiterhin", async () => {
    const { app, admin, autor, controller } = await setup();
    const id = await vertraulichesKo(app, autor);

    for (const [wer, headers] of [
      ["Autor", autor],
      ["Controller", controller],
      ["Admin", admin],
    ] as const) {
      const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
      expect(res.statusCode, `${wer} muss sein vertrauliches KO sehen: ${res.body}`).toBe(200);
      expect(res.json().title).toBe("Vertraulicher Beitrag");

      const versions = await app.inject({
        method: "GET",
        url: `/api/kos/${id}/versions`,
        headers,
      });
      expect(versions.statusCode, `${wer} muss die Versionen sehen: ${versions.body}`).toBe(200);
    }
  });

  it("GEGENPROBE — ein FREMDER Experte (nicht Autor) sieht es nicht: die Ausnahme ist der Autor, nicht die Rolle", async () => {
    const { app, autor, fremd } = await setup();
    const id = await vertraulichesKo(app, autor);

    const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: fremd });
    expect(
      res.statusCode,
      `Ein Experte OHNE Autorschaft darf nicht sehen. Antwort: ${res.statusCode} ${res.body}`,
    ).toBe(404);
  });

  it("KALIBRIERUNG — ein INTERNES KO bleibt für den Betrachter voll sichtbar", async () => {
    const { app, autor, viewer } = await setup();
    const id = await internesKo(app, autor);

    const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: viewer });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().title).toBe("Internes Alltagswissen");
  });
});
