import { describe, expect, it } from "vitest";
import { MAX_OBJECT_BYTES } from "../../../object-store";
import { buildApp, buildServices } from "../build-app";
import { OBJECTS_BODY_LIMIT } from "./object-routes";

// WP-D2 („Original ist heilig"): POST /api/objects trägt einen EXPLIZITEN Route-bodyLimit (30 MiB)
// statt des globalen 1-MiB-Fastify-Defaults — vorher scheiterte jedes normale Nutzer-PDF/DOCX als
// JSON-Data-URL mit 413, BEVOR das Object-Store-Limit überhaupt greifen konnte. Diese Tests pinnen
// beide Schichten: großzügiger Transport (413 erst über 30 MiB) + Objekt-Obergrenze (MAX_OBJECT_BYTES).

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

describe("WP-D2: POST /api/objects — dokumententaugliche Limits", () => {
  it("akzeptiert ein 5-MB-Data-URL-Objekt (unter dem neuen Limit)", async () => {
    const { app, headers } = await adminApp();
    const data = `data:application/pdf;base64,${"A".repeat(5_000_000)}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: { name: "handbuch.pdf", mime: "application/pdf", data, kind: "document" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().size).toBe(data.length);
    expect(res.json().kind).toBe("document");
  });

  it("Data-URL über MAX_OBJECT_BYTES → ehrlicher 400 „Objekt zu groß“", async () => {
    const { app, headers } = await adminApp();
    // Knapp über der Objekt-Obergrenze, aber innerhalb des 30-MiB-Transports — jetzt entscheidet
    // der Object-Store (vorher kam der Request nie an ihm an).
    const data = `data:application/pdf;base64,${"A".repeat(MAX_OBJECT_BYTES + 1)}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: { name: "riesig.pdf", mime: "application/pdf", data, kind: "document" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/zu groß/);
  });

  it("Body über dem 30-MiB-Route-Limit → kontrolliertes 413", async () => {
    const { app, headers } = await adminApp();
    const data = `data:application/pdf;base64,${"A".repeat(OBJECTS_BODY_LIMIT + 1024)}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: { name: "monster.pdf", mime: "application/pdf", data, kind: "document" },
    });
    expect(res.statusCode).toBe(413);
  });
});
