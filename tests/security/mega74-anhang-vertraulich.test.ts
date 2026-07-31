// ================================================================================================
// AUFTRAG-mega74 BLOCK C — DER ANHANG WIRD BEHANDELT WIE SEIN OBJEKT (G2), UND ER ÜBERLEBT
// DIE SPERRE NICHT MEHR EIN JAHR (G4).
// ================================================================================================
//
// DER BEFUND (dieser Test hat ihn beim ersten Lauf selbst geliefert): `object-routes.ts` enthielt
// NULL Bezug auf Vertraulichkeit — ein Anhang wurde ausgeliefert, ohne dass die Stufe seines
// Wissensobjekts je gefragt wurde. Und `object-routes.ts:151` setzte
// `Cache-Control: private, max-age=31536000, immutable`: ein Jahr, unveränderlich. Wer den Anhang
// einmal geholt hatte, behielt ihn ein Jahr im Browser — auch nachdem das Objekt gesperrt wurde.
//
// BEIDE ZUSAGEN WERDEN AM DRAHT GEPRÜFT, nicht am Quelltext. Das ist die Lehre aus mega69: eine
// Kopfzeile, die im Code steht, muss nicht am Draht ankommen (@fastify/static hatte dort den
// setHeaders-Callback überschrieben). Deshalb steht hier `res.headers[...]` und kein `toContain`.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

// Ein winziges, gültiges PNG als Daten-URL (1x1, transparent).
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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
    payload: { name: "Admin", email: "admin@mega74c.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@mega74c.test", "geheim12345");
  for (const [email, role] of [
    ["viewer@mega74c.test", "viewer"],
    ["autor@mega74c.test", "experte"],
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
    autor: await login(app, "autor@mega74c.test", "geheim12345"),
    viewer: await login(app, "viewer@mega74c.test", "geheim12345"),
  };
}

// Lädt ein Bild hoch und hängt es als Anhang an ein frisch erzeugtes KO. Gibt beide Kennungen
// zurück. `vertraulich` steuert, ob das KO danach hochgestuft wird.
async function koMitAnhang(app: App, autor: Auth, vertraulich: boolean) {
  const up = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: autor,
    payload: {
      name: "typenschild.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(up.statusCode, up.body).toBe(201);
  const objectId = up.json().id as string;

  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: vertraulich ? "Vertrauliches mit Anhang" : "Internes mit Anhang",
      statement: "Ein Objekt, an dem ein Original hängt.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const koId = created.json().id as string;

  const attach = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: autor,
    payload: {
      action: "attach",
      attachment: { name: "typenschild.png", mime: "image/png", objectId },
    },
  });
  expect(attach.statusCode, attach.body).toBe(200);

  if (vertraulich) {
    const up2 = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(up2.statusCode, up2.body).toBe(200);
  }
  return { koId, objectId };
}

describe("mega74 C · der Anhang erbt die Stufe seines Wissensobjekts (G2)", () => {
  it("Betrachter bekommt den Anhang eines VERTRAULICHEN Objekts nicht — 404, nicht 403", async () => {
    const { app, autor, viewer } = await setup();
    const { objectId } = await koMitAnhang(app, autor, true);

    const meta = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}`,
      headers: viewer,
    });
    expect(meta.statusCode, `Metadaten-Weg. Antwort: ${meta.statusCode} ${meta.body}`).toBe(404);

    const raw = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: viewer,
    });
    expect(raw.statusCode, `Rohbytes-Weg. Antwort: ${raw.statusCode}`).toBe(404);
    expect(raw.statusCode).not.toBe(403);
  });

  it("GEGENPROBE — Autor und Admin bekommen denselben Anhang weiterhin", async () => {
    const { app, admin, autor } = await setup();
    const { objectId } = await koMitAnhang(app, autor, true);

    for (const [wer, headers] of [
      ["Autor", autor],
      ["Admin", admin],
    ] as const) {
      const raw = await app.inject({
        method: "GET",
        url: `/api/objects/${objectId}/raw`,
        headers,
      });
      expect(raw.statusCode, `${wer} muss den Anhang bekommen`).toBe(200);
    }
  });

  it("KALIBRIERUNG — der Anhang eines INTERNEN Objekts bleibt für den Betrachter erreichbar", async () => {
    const { app, autor, viewer } = await setup();
    const { objectId } = await koMitAnhang(app, autor, false);

    const raw = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: viewer,
    });
    expect(
      raw.statusCode,
      `Ohne diesen Fall hätte der Test oben nur bewiesen, dass die Route
      gar nichts mehr herausgibt. Antwort: ${raw.statusCode}`,
    ).toBe(200);
  });
});

describe("mega74 C · G4 — die Zwischenspeicher-Zusage am DRAHT, nicht im Quelltext", () => {
  it("vertraulicher Anhang: no-store — und NIE mehr ein Jahr oder immutable", async () => {
    const { app, autor } = await setup();
    const { objectId } = await koMitAnhang(app, autor, true);

    const raw = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: autor,
    });
    expect(raw.statusCode).toBe(200);
    const cc = String(raw.headers["cache-control"]);
    expect(cc, "ein vertrauliches Original darf nirgends liegenbleiben").toBe("no-store");
    // Die beiden Zusagen, die vor mega74 hier standen, dürfen NIE wiederkommen.
    expect(cc).not.toContain("immutable");
    expect(cc).not.toContain("31536000");
  });

  it("interner Anhang: kurze Frist statt eines Jahres, und ebenfalls nie immutable", async () => {
    const { app, autor } = await setup();
    const { objectId } = await koMitAnhang(app, autor, false);

    const raw = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: autor,
    });
    expect(raw.statusCode).toBe(200);
    const cc = String(raw.headers["cache-control"]);
    expect(cc, "kurze Frist — eine Höherstufung muss durchgreifen können").toBe(
      "private, max-age=300",
    );
    expect(cc).not.toContain("immutable");
    expect(cc).not.toContain("31536000");
  });
});
