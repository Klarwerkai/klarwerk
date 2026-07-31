// ================================================================================================
// AUFTRAG-mega74 BLOCK D — DIE NEBENWEGE (G5): INHALT, OHNE DAS OBJEKT ZU ÖFFNEN.
// ================================================================================================
//
// DER BEFUND, an den vier Dateien nachgelesen und hier am Draht belegt:
//
//   · `/api/conflicts` und `/api/conflicts/:id` (conflicts-routes.ts:9, :17) gaben `description`
//     und `detector.quotes.a/b` — WÖRTLICHE Belegzitate beider Objekte — an jeden `ko.read`-Inhaber.
//   · `/api/duplicates` und `/api/duplicates/:id` (overlap-routes.ts:25, :76) gaben `aspects`,
//     `eigenanteilA` und `eigenanteilB` heraus, also gerade das, was NUR in je einem der beiden
//     Objekte steht.
//   · `/api/notifications` (notifications-routes.ts:82) stand auf `requireUser` — schwächer noch
//     als `ko.read` — und schrieb Konflikt-Beschreibung, Duplikat-Begründung und den KO-TITEL einer
//     Zuweisung ungefiltert in den Feed.
//   · `lifecycle-routes.ts` war der Gegenfall: seine Dienste liefern `string[]` (KO-IDs bzw.
//     assetRefs, lifecycle/src/service.ts:29,34,46) — dort geht KEIN Inhalt hinaus. Der Kopf hatte
//     bei dieser Datei einen Treffer gezählt; er trägt nicht. Deshalb steht sie hier NICHT.
//
// Ein Zugriffsschutz, der nur den Hauptweg deckt, ist keiner — das ist der ganze Punkt dieses
// Blocks.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const GEHEIM = "Der geheime Kern, den ein Betrachter nie lesen darf.";

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

async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@mega74d.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@mega74d.test", "geheim12345");
  for (const [email, role] of [
    ["viewer@mega74d.test", "viewer"],
    ["autor@mega74d.test", "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    admin,
    autor: await login(app, "autor@mega74d.test", "geheim12345"),
    viewer: await login(app, "viewer@mega74d.test", "geheim12345"),
  };
}

async function ko(app: App, autor: Auth, titel: string, vertraulich: boolean): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: titel,
      statement: vertraulich ? GEHEIM : "Ganz gewöhnlicher interner Inhalt.",
      type: "best_practice",
      category: "Anlage 1",
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

// Legt einen Konflikt zwischen einem VERTRAULICHEN und einem internen Objekt an — mit wörtlichen
// Belegzitaten, damit der Test misst, was der Nebenweg wirklich preisgibt.
// Der Konflikt selbst wird vom Admin angelegt (`ko.validate` — die Erkennung ist eine kuratorische
// Handlung); die beiden Objekte gehören dem Autor.
async function konfliktPaar(app: App, autor: Auth, kurator: Auth) {
  const geheim = await ko(app, autor, "Vertraulicher Streitpunkt", true);
  const offen = await ko(app, autor, "Interner Gegenpol", false);
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${geheim}`,
    headers: kurator,
    payload: {
      action: "conflict",
      conflict: {
        koA: geheim,
        koB: offen,
        type: "widerspruch",
        description: `Widerspruch zu: ${GEHEIM}`,
      },
    },
  });
  expect(res.statusCode, `Konflikt anlegen: ${res.body}`).toBe(201);
  return { geheim, offen };
}

describe("mega74 D · die Nebenwege geben keinen vertraulichen Inhalt mehr preis", () => {
  it("GET /api/conflicts — der Betrachter sieht den Konflikt eines vertraulichen Objekts nicht", async () => {
    const { app, admin, autor, viewer } = await setup();
    await konfliktPaar(app, autor, admin);

    const res = await app.inject({ method: "GET", url: "/api/conflicts", headers: viewer });
    expect(res.statusCode).toBe(200);
    expect(
      res.body,
      `Die Konfliktliste trug den vertraulichen Kern. Antwort: ${res.body}`,
    ).not.toContain(GEHEIM);
    expect(res.json()).toHaveLength(0);
  });

  it("GEGENPROBE — Autor und Admin sehen denselben Konflikt weiterhin", async () => {
    const { app, admin, autor } = await setup();
    await konfliktPaar(app, autor, admin);

    for (const [wer, headers] of [
      ["Autor", autor],
      ["Admin", admin],
    ] as const) {
      const res = await app.inject({ method: "GET", url: "/api/conflicts", headers });
      expect(res.statusCode).toBe(200);
      expect(res.json(), `${wer} muss den Konflikt sehen`).toHaveLength(1);
    }
  });

  it("KALIBRIERUNG — ein Konflikt zwischen zwei INTERNEN Objekten bleibt für den Betrachter sichtbar", async () => {
    const { app, admin, autor, viewer } = await setup();
    const a = await ko(app, autor, "Interner A", false);
    const b = await ko(app, autor, "Interner B", false);
    const angelegt = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: admin,
      payload: {
        action: "conflict",
        conflict: {
          koA: a,
          koB: b,
          type: "widerspruch",
          description: "Zwei interne Aussagen kollidieren.",
        },
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);

    const res = await app.inject({ method: "GET", url: "/api/conflicts", headers: viewer });
    expect(res.statusCode).toBe(200);
    expect(
      res.json(),
      "Ohne diesen Fall hätte der Test oben nur bewiesen, dass die Liste immer leer ist",
    ).toHaveLength(1);
  });

  it("GET /api/notifications — die Glocke trägt den vertraulichen Kern nicht mehr", async () => {
    const { app, admin, autor, viewer } = await setup();
    await konfliktPaar(app, autor, admin);

    const res = await app.inject({ method: "GET", url: "/api/notifications", headers: viewer });
    expect(res.statusCode).toBe(200);
    expect(res.body, `Die Glocke trug den Kern. Antwort: ${res.body}`).not.toContain(GEHEIM);
  });

  it("GET /api/duplicates — die Liste bleibt für den Betrachter frei von vertraulichen Paaren", async () => {
    const { app, admin, autor, viewer } = await setup();
    await konfliktPaar(app, autor, admin);

    const res = await app.inject({ method: "GET", url: "/api/duplicates", headers: viewer });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(GEHEIM);
  });
});
