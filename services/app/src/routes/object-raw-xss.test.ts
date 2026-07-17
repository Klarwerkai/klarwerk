import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";

// SCRUM-503: /api/objects/:id/raw darf nutzerbestimmtes MIME nicht 1:1 inline auf dem App-Origin
// ausliefern (Stored XSS → Admin-Session-Takeover). Fix: Bild-Allowlist inline mit echtem Typ,
// alles andere → application/octet-stream + Content-Disposition: attachment + nosniff.
describe("SCRUM-503: Object-Store /raw neutralisiert MIME/Disposition", () => {
  async function loggedInApp() {
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

  async function upload(
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
    name: string,
    mime: string,
    payload: string,
  ): Promise<string> {
    const dataUrl = `data:${mime};base64,${Buffer.from(payload).toString("base64")}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: { name, mime, data: dataUrl },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  it("hochgeladenes text/html mit Script → NICHT inline als text/html (octet-stream + attachment + nosniff)", async () => {
    const { app, headers } = await loggedInApp();
    const id = await upload(
      app,
      headers,
      "boese.html",
      "text/html",
      "<script>alert(document.cookie)</script>",
    );
    const res = await app.inject({ method: "GET", url: `/api/objects/${id}/raw`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream"); // NICHT text/html
    expect(res.headers["content-disposition"]).toMatch(/^attachment/); // kein inline-Rendering
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("hochgeladenes SVG → ebenfalls neutralisiert (SVG kann Skripte tragen)", async () => {
    const { app, headers } = await loggedInApp();
    const id = await upload(
      app,
      headers,
      "bild.svg",
      "image/svg+xml",
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const res = await app.inject({ method: "GET", url: `/api/objects/${id}/raw`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-disposition"]).toMatch(/^attachment/);
  });

  it("echtes Bild (image/png) → unverändert inline mit echtem Typ (Editor-<img>-Fall)", async () => {
    const { app, headers } = await loggedInApp();
    const id = await upload(app, headers, "foto.png", "image/png", "\x89PNG\r\n\x1a\nfake-bytes");
    const res = await app.inject({ method: "GET", url: `/api/objects/${id}/raw`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["content-disposition"]).toBe("inline");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("Content-Disposition-Dateiname entschärft (keine Header-Injection/Steuerzeichen)", async () => {
    const { app, headers } = await loggedInApp();
    const id = await upload(
      app,
      headers,
      'a"; drop\r\nX-Evil: 1',
      "application/pdf",
      "%PDF-1.4 fake",
    );
    const res = await app.inject({ method: "GET", url: `/api/objects/${id}/raw`, headers });
    expect(res.statusCode).toBe(200);
    const cd = String(res.headers["content-disposition"]);
    // Nur harmlose Zeichen im (gequoteten) Namen → kein CRLF (Header-Injection) und kein ausbrechendes
    // Anführungszeichen. Dass harmlose Buchstaben wie „X-Evil" im Dateinamen bleiben, ist unkritisch.
    expect(cd).toMatch(/^attachment; filename="[\w.\-]+"$/);
    expect(cd).not.toContain("\r");
    expect(cd).not.toContain("\n");
    expect(cd).not.toContain(":"); // kein Header-Trenner in den Namen geschmuggelt
  });
});
