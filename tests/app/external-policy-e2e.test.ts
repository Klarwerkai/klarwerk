import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  DEFAULT_EXTERNAL_KNOWLEDGE_STAGE,
  normalizeExternalKnowledgeStage,
} from "../../services/external-search";

// SCRUM-414 (Pedi 03.07.): Admin-Regler „externe Wissensabfrage" — 4 Stufen von blockiert
// bis offen, persistiert, mit Server-Gate. HTTP end-to-end über die echten Routen.
describe("SCRUM-414: Regler externe Wissensabfrage", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    const headers = { authorization: `Bearer ${res.json().token}` };
    return { headers };
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

  it("Normalisierung: nur die vier bekannten Stufen, alles andere wird abgewiesen", () => {
    for (const ok of ["blocked", "search_on_click", "search_attach", "open"]) {
      expect(normalizeExternalKnowledgeStage(ok)).toBe(ok);
    }
    for (const bad of ["", "offen", "on", 3, null, undefined]) {
      expect(() => normalizeExternalKnowledgeStage(bad)).toThrow();
    }
  });

  it("GET liefert den restriktiven Standard; Admin setzt; Experte darf lesen, nicht setzen", async () => {
    const { app, admin, erik } = await setup();
    const before = await app.inject({
      method: "GET",
      url: "/api/external/policy",
      headers: erik.headers,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().stage).toBe(DEFAULT_EXTERNAL_KNOWLEDGE_STAGE);
    expect(before.json().stage).toBe("search_on_click");

    const put = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers: admin.headers,
      payload: { stage: "open" },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().stage).toBe("open");

    const after = await app.inject({
      method: "GET",
      url: "/api/external/policy",
      headers: erik.headers,
    });
    expect(after.json().stage).toBe("open");

    // Experte darf NICHT setzen (users.manage).
    const forbidden = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers: erik.headers,
      payload: { stage: "blocked" },
    });
    expect(forbidden.statusCode).toBe(403);

    // Ungültige Stufe → 400, Stand unverändert.
    const bad = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers: admin.headers,
      payload: { stage: "voll-offen" },
    });
    expect(bad.statusCode).toBe(400);
    const still = await app.inject({
      method: "GET",
      url: "/api/external/policy",
      headers: admin.headers,
    });
    expect(still.json().stage).toBe("open");
  });

  it("Gate: bei blocked ist die externe Suche serverseitig gesperrt (403), sonst nicht", async () => {
    const { app, admin, erik } = await setup();
    await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers: admin.headers,
      payload: { stage: "blocked" },
    });
    const blocked = await app.inject({
      method: "GET",
      url: "/api/external/search?q=Dosierpumpe",
      headers: erik.headers,
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toBe("EXTERNAL_SEARCH_BLOCKED");

    // Freigeben → nicht mehr blockiert (der Proxy selbst ist im Test aus → 501, NICHT 403).
    await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers: admin.headers,
      payload: { stage: "search_on_click" },
    });
    const allowed = await app.inject({
      method: "GET",
      url: "/api/external/search?q=Dosierpumpe",
      headers: erik.headers,
    });
    expect(allowed.statusCode).not.toBe(403);
  });
});
