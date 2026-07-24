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
      // SCRUM-521 (WP1): die Vertraulichkeit wird BEIM UPLOAD persistiert (Quelle der Wahrheit).
      // Bewusst intern → dieser Fall prüft den „kein Dienst konfiguriert"-Zustand (nicht den
      // Vertraulichkeits-Block). Ohne gespeicherte Stufe wäre es fail-safe vertraulich (Test unten).
      payload: {
        name: "uebergabe.mp4",
        mime: "video/mp4",
        data: `data:video/mp4;base64,${Buffer.from("clip").toString("base64")}`,
        confidentiality: "intern",
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

  // SCRUM-521 (WP1) KERN am HTTP-Rand: ein als vertraulich HOCHGELADENES Medium bleibt vertraulich,
  // auch wenn der Analyse-Request "intern" behauptet. Der Client kann über den Request NICHT herabstufen.
  // Ohne den Fix (Route vertraut der Request-Stufe) käme kein Vertraulichkeits-Block → Test schlägt fehl.
  it("SCRUM-521: gespeichert vertraulich + Request 'intern' → keine Herabstufung, kein Egress", async () => {
    const { app, headers } = await setup();
    const put = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: {
        name: "vertraulich.mp4",
        mime: "video/mp4",
        data: `data:video/mp4;base64,${Buffer.from("secret").toString("base64")}`,
        confidentiality: "vertraulich",
      },
    });
    const analyzed = await app.inject({
      method: "POST",
      url: "/api/media/analyze",
      headers,
      payload: { objectId: put.json().id, locale: "de", confidentiality: "intern" }, // Herabstufungsversuch
    });
    expect(analyzed.statusCode).toBe(200);
    expect(analyzed.json().engineActive).toBe(false);
    expect(analyzed.json().transcript).toBeNull();
    expect(analyzed.json().note).toContain("Vertrauliche");
  });

  // SCRUM-521 (WP2, nacht24) am HTTP-Rand: das Objekt wurde „intern" hochgeladen — hängt es an
  // einem VERTRAULICHEN KO, gewinnt die restriktivste Stufe (KO-Kontext, serverseitig aufgelöst).
  // Ohne Transcriber-Schlüssel ist der Unterschied ehrlich sichtbar: vorher „nicht aktiv"
  // (Inaktiv-Zustand), nach dem Anhängen an das vertrauliche KO „Vertrauliche…" (Egress-Block —
  // der greift VOR der Schlüssel-Prüfung, ein konfigurierter Transcriber liefe also ebenfalls nie).
  it("SCRUM-521 WP2: intern hochgeladen + Anhang an vertraulichem KO → KO-Kontext gewinnt", async () => {
    const { app, headers } = await setup();
    const put = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: {
        name: "rundgang.mp4",
        mime: "video/mp4",
        data: `data:video/mp4;base64,${Buffer.from("walk").toString("base64")}`,
        confidentiality: "intern",
      },
    });
    expect(put.statusCode).toBe(201);
    const objectId = put.json().id as string;

    // Vorher: kein KO-Bezug → die Analyse endet am ehrlichen Inaktiv-Zustand (kein Schlüssel),
    // NICHT am Vertraulichkeits-Block.
    const before = await app.inject({
      method: "POST",
      url: "/api/media/analyze",
      headers,
      payload: { objectId, locale: "de" },
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().note).toContain("nicht aktiv");

    // KO anlegen, Objekt als Anhang anfügen, KO vertraulich stufen.
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Anlagen-Rundgang",
        statement: "Interner Rundgang mit sensiblen Details.",
        type: "best_practice",
        category: "Anlage 1",
        tags: [],
      },
    });
    expect(ko.statusCode).toBe(201);
    const koId = ko.json().id as string;
    const attach = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "attach",
        attachment: { name: "rundgang.mp4", mime: "video/mp4", objectId },
      },
    });
    expect(attach.statusCode).toBe(200);
    const level = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(level.statusCode).toBe(200);

    // Nachher: der KO-Kontext gewinnt — Vertraulichkeits-Block statt Inaktiv-Zustand, kein Egress.
    const after = await app.inject({
      method: "POST",
      url: "/api/media/analyze",
      headers,
      payload: { objectId, locale: "de" },
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().transcript).toBeNull();
    expect(after.json().engineActive).toBe(false);
    expect(after.json().note).toContain("Vertrauliche");
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
