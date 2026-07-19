import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";
import { DRAFTS_BODY_LIMIT } from "./capture-routes";

// WP-D1c: POST/PUT /api/drafts tragen einen dokument-tauglichen bodyLimit (DRAFTS_BODY_LIMIT, 25 MiB)
// statt des globalen 1-MiB-Fastify-Defaults — ein bildreicher Entwurf (viele komprimierte Inline-Bilder)
// wird NICHT mehr mit 413 abgewiesen.

async function adminApp() {
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

// ~2 MiB bodyHtml — unter dem globalen 1-MiB-Default NICHT möglich, unter DRAFTS_BODY_LIMIT problemlos.
function bigBodyHtml(): string {
  const img = `<img src="data:image/jpeg;base64,${"Q".repeat(200_000)}">`;
  return `<h2>Handbuch</h2>${img.repeat(10)}`;
}

describe("WP-D1d: /api/drafts akzeptiert dokument-große Bodies (5-MiB-Ceiling)", () => {
  it("Ceiling = 5 MiB (klein, aber deutlich über 1 MiB)", () => {
    expect(DRAFTS_BODY_LIMIT).toBe(5 * 1024 * 1024);
  });

  it("anonymer POST mit Body → 401 (Auth VOR Body-Parsing)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      payload: {
        title: "Anon",
        statement: "x",
        type: "best_practice",
        category: "Allgemein",
        bodyHtml: bigBodyHtml(),
        origin: "frontdoor",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/drafts mit ~2 MiB bodyHtml → 201 (kein 413)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Wartungshandbuch",
        statement: "Handbuch mit vielen Diagrammen.",
        type: "best_practice",
        category: "Allgemein",
        bodyHtml: bigBodyHtml(),
        origin: "frontdoor",
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it("PUT /api/drafts/:id mit großem bodyHtml → 200 (derselbe Cap greift)", async () => {
    const { app, headers } = await adminApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Entwurf",
        statement: "Kurz.",
        type: "best_practice",
        category: "Allgemein",
        origin: "frontdoor",
      },
    });
    expect(created.statusCode).toBe(201);
    const put = await app.inject({
      method: "PUT",
      url: `/api/drafts/${created.json().id}`,
      headers,
      payload: {
        title: "Entwurf",
        statement: "Kurz.",
        type: "best_practice",
        category: "Allgemein",
        bodyHtml: bigBodyHtml(),
        origin: "frontdoor",
      },
    });
    expect(put.statusCode).toBe(200);
  });
});
