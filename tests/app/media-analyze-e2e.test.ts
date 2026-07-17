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
      // SCRUM-502 R7: bewusst intern → dieser Fall prüft den „kein Dienst konfiguriert"-Zustand
      // (nicht den Vertraulichkeits-Block). Ohne Stufe wäre es fail-safe vertraulich (eigener Test unten).
      payload: { objectId: put.json().id, locale: "de", confidentiality: "intern" },
    });
    expect(analyzed.statusCode).toBe(200);
    expect(analyzed.json().engineActive).toBe(false);
    expect(analyzed.json().transcript).toBeNull();
    expect(analyzed.json().note).toContain("nicht aktiv");
  });

  it("SCRUM-502 R7: ohne Vertraulichkeits-Stufe → fail-safe vertraulich, kein Transkriptions-Egress", async () => {
    const { app, headers } = await setup();
    const put = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: {
        name: "geheim.mp4",
        mime: "video/mp4",
        data: `data:video/mp4;base64,${Buffer.from("fake").toString("base64")}`,
        kind: "video",
      },
    });
    const analyzed = await app.inject({
      method: "POST",
      url: "/api/media/analyze",
      headers,
      payload: { objectId: put.json().id, locale: "de" }, // KEINE Stufe → fail-safe vertraulich
    });
    expect(analyzed.statusCode).toBe(200);
    expect(analyzed.json().engineActive).toBe(false);
    expect(analyzed.json().transcript).toBeNull();
    expect(analyzed.json().note).toContain("Vertrauliche");
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
