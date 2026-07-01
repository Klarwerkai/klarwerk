import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-382 HTTP-E2E: Upload eines Videos über /api/objects, Analyse über /api/media/analyze.
// Ohne konfigurierten Dienst antwortet die API ehrlich mit engineActive=false (kein Fake).
describe("SCRUM-382: /api/media/analyze (HTTP end-to-end)", () => {
  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  it("Video hochladen → Analyse liefert ehrlichen Inaktiv-Zustand ohne Schlüssel", async () => {
    const { app, headers } = await setup();
    const put = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: {
        name: "uebergabe.mp4",
        mime: "video/mp4",
        data: `data:video/mp4;base64,${Buffer.from("clip").toString("base64")}`,
      },
    });
    expect(put.statusCode).toBe(201);
    expect(put.json().kind).toBe("video");

    const status = await app.inject({ method: "GET", url: "/api/media/status", headers });
    expect(status.json().active).toBe(false);

    const analyzed = await app.inject({
      method: "POST",
      url: "/api/media/analyze",
      headers,
      payload: { objectId: put.json().id, locale: "de" },
    });
    expect(analyzed.statusCode).toBe(200);
    expect(analyzed.json().engineActive).toBe(false);
    expect(analyzed.json().transcript).toBeNull();
  });

  it("Nicht-Video wird mit 400 abgewiesen, Unbekanntes mit 404", async () => {
    const { app, headers } = await setup();
    const img = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: {
        name: "foto.png",
        mime: "image/png",
        data: `data:image/png;base64,${Buffer.from("img").toString("base64")}`,
      },
    });
    const bad = await app.inject({
      method: "POST",
      url: "/api/media/analyze",
      headers,
      payload: { objectId: img.json().id },
    });
    expect(bad.statusCode).toBe(400);
    const missing = await app.inject({
      method: "POST",
      url: "/api/media/analyze",
      headers,
      payload: { objectId: "nix" },
    });
    expect(missing.statusCode).toBe(404);
  });
});
