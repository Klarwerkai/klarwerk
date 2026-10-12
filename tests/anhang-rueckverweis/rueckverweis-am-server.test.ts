// ================================================================================================
// R-0095 — ANHANG UND WISSENSOBJEKT VERWEISEN AUFEINANDER, NICHT NUR IN EINE RICHTUNG.
// ================================================================================================
//
// Hinrichtung (Bestand): das Wissensobjekt trägt `attachments[].objectId`.
// Rückrichtung (neu): `GET /api/objects/:id/traeger` nennt aus Sicht des Anhangs die lesbaren
// Wissensobjekte, die ihn tragen. Gemessen an der echten App über die echten Routen; dazu die
// Grenzen, an denen ein Rückverweis zum Leck würde (vertraulicher Träger, unbekannte Kennung).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function login(app: App, email: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
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
    payload: { name: "Admin", email: "admin@r0095.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@r0095.test");
  for (const [email, role] of [
    ["viewer@r0095.test", "viewer"],
    ["autor@r0095.test", "experte"],
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
    autor: await login(app, "autor@r0095.test"),
    viewer: await login(app, "viewer@r0095.test"),
  };
}

async function koMitAnhang(app: App, autor: Auth, titel: string) {
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
      confidentiality: "intern",
      title: titel,
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
  return { koId, objectId };
}

const traeger = (app: App, auth: Auth, objectId: string) =>
  app.inject({ method: "GET", url: `/api/objects/${objectId}/traeger`, headers: auth });

describe("R-0095 · Anhang ↔ Wissensobjekt in beiden Richtungen", () => {
  it("R1 · Hinrichtung am Objekt, Rückrichtung am Anhang — dieselbe Kopplung", async () => {
    const { app, autor, viewer } = await setup();
    const { koId, objectId } = await koMitAnhang(app, autor, "Typenschild Presse 4");

    const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: autor });
    const anhaenge = (ko.json().attachments ?? []) as { objectId?: string }[];
    expect(anhaenge.map((a) => a.objectId)).toContain(objectId);

    for (const wer of [autor, viewer]) {
      const r = await traeger(app, wer, objectId);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json()).toEqual({ traeger: [{ id: koId, title: "Typenschild Presse 4" }] });
      expect(r.headers["cache-control"]).toBe("no-store");
    }
  });

  it("R2 · nach dem Entfernen des Anhangs nennt der Anhang kein Objekt mehr", async () => {
    const { app, autor } = await setup();
    const { koId, objectId } = await koMitAnhang(app, autor, "Wird gelöst");
    const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: autor });
    const anhangId = (ko.json().attachments as { id: string }[])[0]?.id;
    const detach = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "detach", attachmentId: anhangId },
    });
    expect(detach.statusCode, detach.body).toBe(200);
    const r = await traeger(app, autor, objectId);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ traeger: [] });
  });

  it("R3 · vertraulicher Träger: wer ihn nicht lesen darf, bekommt 404 wie bei /raw", async () => {
    const { app, autor, viewer } = await setup();
    const { koId, objectId } = await koMitAnhang(app, autor, "Vertrauliches mit Anhang");
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);

    const raw = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: viewer,
    });
    const r = await traeger(app, viewer, objectId);
    expect(r.statusCode).toBe(raw.statusCode);
    expect(r.statusCode).toBe(404);
    expect(r.body).not.toContain("Vertrauliches");
    expect(r.body).not.toContain(koId);

    const eigen = await traeger(app, autor, objectId);
    expect(eigen.json()).toEqual({ traeger: [{ id: koId, title: "Vertrauliches mit Anhang" }] });
  });

  it("R4 · unbekannte Kennung: 404, dieselbe Antwort wie die Metadatenroute", async () => {
    const { app, autor } = await setup();
    const r = await traeger(app, autor, "gibt-es-nicht");
    const meta = await app.inject({
      method: "GET",
      url: "/api/objects/gibt-es-nicht",
      headers: autor,
    });
    expect(r.statusCode).toBe(404);
    expect(r.body).toBe(meta.body);
  });
});
