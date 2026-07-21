// WP-BILD-1c: describe im bestehenden Reasoner-Dispatcher (POST /api/reasoner) — gleicher Guard
// (ko.read) wie die übrigen Tasks, deterministische Prüfungen VOR dem Modell: Format (400) und
// Größendeckel 5 MB (413, ehrliche Meldung). Ohne Modell (Testumgebung) antwortet der Server
// ehrlich mit text null + fallbackReason — kein erfundener Text über HTTP.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { MAX_DESCRIBE_IMAGE_DATAURL_CHARS } from "../../services/reasoner";

const PNG_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

async function loginHeaders(app: ReturnType<typeof buildApp>): Promise<{ authorization: string }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Nutzer", email: "n@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "n@x.de", password: "secret123" },
  });
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

describe("WP-BILD-1c: POST /api/reasoner task=describe", () => {
  it("bleibt hinter dem Login-Guard (401 ohne Anmeldung — RBAC-Fläche unverändert)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      payload: { task: "describe", dataUrl: PNG_URL },
    });
    expect(res.statusCode).toBe(401);
  });

  it("fehlende oder Nicht-Bild-dataUrl → 400 mit ehrlicher Meldung", async () => {
    const app = buildApp(buildServices());
    const headers = await loginHeaders(app);
    const missing = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "describe" },
    });
    expect(missing.statusCode).toBe(400);
    const wrong = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "describe", dataUrl: "data:text/html;base64,AAAA" },
    });
    expect(wrong.statusCode).toBe(400);
  });

  it("Größendeckel: eine dataUrl über 5 MB wird mit 413 abgelehnt (nichts geht zum Modell)", async () => {
    const app = buildApp(buildServices());
    const headers = await loginHeaders(app);
    const huge = `data:image/png;base64,${"A".repeat(MAX_DESCRIBE_IMAGE_DATAURL_CHARS)}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "describe", dataUrl: huge },
    });
    expect(res.statusCode).toBe(413);
    expect((res.json() as { error: string }).error).toBe("PAYLOAD_TOO_LARGE");
  });

  it("ohne Modell: 200 mit text null + fallbackReason (ehrlich, kein Pseudo-Text)", async () => {
    const app = buildApp(buildServices());
    const headers = await loginHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: {
        task: "describe",
        dataUrl: PNG_URL,
        locale: "de",
        source: "draft",
        confidentiality: "intern",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { text: string | null; demo: boolean; fallbackReason?: string };
    expect(body.text).toBeNull();
    expect(body.demo).toBe(true);
    expect(body.fallbackReason).toBe("no-model");
  });
});
