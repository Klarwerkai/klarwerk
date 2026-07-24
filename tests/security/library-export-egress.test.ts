import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-506 (nacht24 Paket 2) am HTTP-Rand: der Bibliotheks-Export (GET /api/library/export) ist
// ein Egress-Kanal und durchsetzt DIESELBE Policy wie das normale Lesen — Validiert-only immer,
// vertrauliche KOs NUR für Berechtigte (Rollen-Bindung includeConfidential = ko.validate an der
// Route). Die Service-Logik ist in services/library-analytics/src/service.test.ts gepinnt; DIESER
// Test pinnt die ROLLEN-BINDUNG über die echte Route (Nicht-Berechtigter vs. Berechtigter).
describe("SCRUM-506: /api/library/export — Policy am HTTP-Rand (Rollen-Bindung)", () => {
  async function setup() {
    const services = buildServices();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@x.de", password: "secret123" },
    });
    const adminHeaders = { authorization: `Bearer ${adminLogin.json().token}` };
    // Admin legt einen Viewer an (sofort freigegeben) — der Nicht-Berechtigte dieses Tests.
    const createdViewer = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: adminHeaders,
      payload: { name: "Vera Viewer", email: "viewer@x.de", password: "secret123", role: "viewer" },
    });
    expect(createdViewer.statusCode).toBe(201);
    const viewerLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "viewer@x.de", password: "secret123" },
    });
    const viewerHeaders = { authorization: `Bearer ${viewerLogin.json().token}` };

    // Bestand: A = validiert + intern, B = validiert + VERTRAULICH, C = offen (nicht validiert).
    const koService = services.ko;
    const a = await koService.create({
      title: "Ventil entlasten",
      statement: "Vor Wartung Druck ablassen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "admin",
      tags: [],
    });
    await koService.setValidationState(a.id, { trust: 80, status: "validiert" });
    const b = await koService.create({
      title: "Geheime Prozedur",
      statement: "Vertraulicher Kerntext.",
      type: "best_practice",
      category: "Anlage 1",
      author: "admin",
      tags: [],
    });
    await koService.setValidationState(b.id, { trust: 80, status: "validiert" });
    await koService.setConfidentiality(b.id, "vertraulich", "admin");
    await koService.create({
      title: "Roher Entwurf",
      statement: "Noch nicht geprüft.",
      type: "best_practice",
      category: "Anlage 1",
      author: "admin",
      tags: [],
    });
    return { app, adminHeaders, viewerHeaders };
  }

  it("Nicht-Berechtigter (viewer): Export enthält vertrauliche KOs NICHT und nur Validiertes", async () => {
    const { app, viewerHeaders } = await setup();
    const res = await app.inject({
      method: "GET",
      url: "/api/library/export",
      headers: viewerHeaders,
    });
    expect(res.statusCode).toBe(200);
    const items = res.json() as { title: string; status: string }[];
    expect(items.map((k) => k.title)).toEqual(["Ventil entlasten"]);
    expect(items.every((k) => k.status === "validiert")).toBe(true);
    // Auch die Text-Formate tragen den vertraulichen Titel nicht (derselbe Filter davor).
    const md = await app.inject({
      method: "GET",
      url: "/api/library/export?format=markdown",
      headers: viewerHeaders,
    });
    expect(md.statusCode).toBe(200);
    expect(md.body).toContain("Ventil entlasten");
    expect(md.body).not.toContain("Geheime Prozedur");
    expect(md.body).not.toContain("Roher Entwurf");
  });

  it("Berechtigter (admin, ko.validate): Export unverändert inkl. vertraulicher validierter KOs — aber weiterhin Validiert-only", async () => {
    const { app, adminHeaders } = await setup();
    const res = await app.inject({
      method: "GET",
      url: "/api/library/export",
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    const titles = (res.json() as { title: string; status: string }[]).map((k) => k.title).sort();
    expect(titles).toEqual(["Geheime Prozedur", "Ventil entlasten"]);
    expect((res.json() as { status: string }[]).every((k) => k.status === "validiert")).toBe(true);
  });

  it("Ohne Anmeldung: 401 — der Export ist nie offen", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/library/export" });
    expect(res.statusCode).toBe(401);
  });
});
