// ================================================================================================
// AUFNAHME 20260922 · Runde 2 (Bens Befund B2) — die lose Fußnote über den echten Speicher- und
// Suchweg: `POST /api/kos` (Server-Sanitizer) → `GET /api/library/images` (Bildsuche).
//
// Bild und Fußnote stehen getrennt, die Fußnote trägt ausdrücklich die Kennung des Bildes. Bisher
// strich der Sanitizer diese Kennung, die Beschreibung war danach keinem Bild mehr zugeordnet.
// Aufbau wie `tests/bildsuche/route.test.ts`.
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

async function setup(): Promise<{ app: App; admin: Auth }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@lose.test", password: "geheim12345" },
  });
  return { app, admin: await login(app, "admin@lose.test", "geheim12345") };
}

async function anlegen(app: App, headers: Auth, bodyHtml: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Lagerbefund",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml,
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Anlage fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return res.json().id as string;
}

const LOSE =
  '<figure data-image-id="lager-1"><img data-image-id="lager-1" src="/api/objects/l1/raw"></figure>' +
  '<figcaption data-image-id="lager-1">Lagerschale mit Riefen</figcaption>';

describe("B2 · lose Fußnote mit Bildkennung über Speichern und Bildsuche", () => {
  it("die Kennung übersteht POST /api/kos → GET /api/kos/:id", async () => {
    const { app, admin } = await setup();
    const id = await anlegen(app, admin, LOSE);
    const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: admin });
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.stringify(res.json())).toContain(
      '<figcaption data-image-id=\\"lager-1\\">Lagerschale mit Riefen</figcaption>',
    );
  });

  it("die Bildsuche liefert das Bild mit dieser Beschreibung", async () => {
    const { app, admin } = await setup();
    await anlegen(app, admin, LOSE);
    const res = await app.inject({
      method: "GET",
      url: "/api/library/images?q=Lagerschale",
      headers: admin,
    });
    expect(res.statusCode, res.body).toBe(200);
    const treffer = (res.json() as { treffer: { imageId: string; caption: string }[] }).treffer;
    expect(treffer.map((t) => [t.imageId, t.caption])).toEqual([
      ["lager-1", "Lagerschale mit Riefen"],
    ]);
  });

  it("Gegenprobe: hat das Bild eine eigene (leere) Fußnote, wird die lose nicht geraten", async () => {
    const { app, admin } = await setup();
    await anlegen(
      app,
      admin,
      '<figure data-image-id="lager-1"><img data-image-id="lager-1" src="/api/objects/l1/raw">' +
        '<figcaption data-image-id="lager-1"></figcaption></figure>' +
        '<figcaption data-image-id="lager-1">Lagerschale mit Riefen</figcaption>',
    );
    const res = await app.inject({
      method: "GET",
      url: "/api/library/images?q=Lagerschale",
      headers: admin,
    });
    const treffer = (res.json() as { treffer: { caption: string }[] }).treffer;
    expect(treffer.map((t) => t.caption)).not.toContain("Lagerschale mit Riefen");
  });
});
