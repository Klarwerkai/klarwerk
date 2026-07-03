import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { DEFAULT_UPLOAD_LIMITS, normalizeUploadLimits } from "../../services/knowledge-object";

// SCRUM-421 (Pedi 03.07.): Upload-Grenzen sichtbar + im Admin einstellbar, serverseitig erzwungen.
describe("SCRUM-421: einstellbare Upload-Grenzen", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { headers: { authorization: `Bearer ${res.json().token}` } };
  }

  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin.headers });
    const erik = await login(app, "erik@demo.klarwerk", "demo-pass-erik");
    return { app, admin, erik };
  }

  it("Normalisierung: ganze Zahlen im erlaubten Band; sonst Fehler", () => {
    expect(normalizeUploadLimits({ maxAttachments: 5, maxAttachmentBytes: 1_000_000 })).toEqual({
      maxAttachments: 5,
      maxAttachmentBytes: 1_000_000,
    });
    for (const bad of [
      { maxAttachments: 0, maxAttachmentBytes: 1_000_000 },
      { maxAttachments: 5, maxAttachmentBytes: 10 },
      { maxAttachments: 2.5, maxAttachmentBytes: 1_000_000 },
      { maxAttachments: 5 },
      {},
    ]) {
      expect(() => normalizeUploadLimits(bad)).toThrow();
    }
  });

  it("GET liefert die Werksvorgabe; Admin setzt; Experte darf lesen, nicht setzen", async () => {
    const { app, admin, erik } = await setup();
    const before = await app.inject({
      method: "GET",
      url: "/api/upload-limits",
      headers: erik.headers,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toEqual(DEFAULT_UPLOAD_LIMITS);

    const put = await app.inject({
      method: "PUT",
      url: "/api/upload-limits",
      headers: admin.headers,
      payload: { maxAttachments: 3, maxAttachmentBytes: 1_500_000 },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().maxAttachments).toBe(3);

    const forbidden = await app.inject({
      method: "PUT",
      url: "/api/upload-limits",
      headers: erik.headers,
      payload: { maxAttachments: 1, maxAttachmentBytes: 100_000 },
    });
    expect(forbidden.statusCode).toBe(403);

    const bad = await app.inject({
      method: "PUT",
      url: "/api/upload-limits",
      headers: admin.headers,
      payload: { maxAttachments: 0, maxAttachmentBytes: 1_500_000 },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("die eingestellte Anhang-Anzahl wird serverseitig erzwungen", async () => {
    const { app, admin, erik } = await setup();
    await app.inject({
      method: "PUT",
      url: "/api/upload-limits",
      headers: admin.headers,
      payload: { maxAttachments: 1, maxAttachmentBytes: 1_000_000 },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: erik.headers,
      payload: {
        title: "Mit Anhang",
        statement: "Bild anhängen.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    const koId = created.json().id as string;
    const img = { name: "a.png", mime: "image/png", dataUrl: "data:image/png;base64,AAAA" };

    const first = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: erik.headers,
      payload: { action: "attach", attachment: img },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: erik.headers,
      payload: { action: "attach", attachment: { ...img, name: "b.png" } },
    });
    expect(second.statusCode).toBe(400);
    expect(String(second.json().message)).toContain("Maximal 1");
  });
});
