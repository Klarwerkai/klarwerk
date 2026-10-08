import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-463 (WP4): Admin legt Nutzer an — Ende-zu-Ende + ehrliche Fehlerfälle statt opakem 500.
async function adminApp() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@x.de", password: "secret123" },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

describe("SCRUM-463 WP4: Admin 'Nutzer anlegen'", () => {
  it("legt einen Nutzer an (201, erscheint in der Liste, Rolle gesetzt)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Vip", email: "vip@x.de", password: "vippass12", role: "experte" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().role).toBe("experte");
    const list = await app.inject({ method: "GET", url: "/api/users", headers });
    expect(list.json().some((u: { name: string }) => u.name === "Vip")).toBe(true);
  });

  it("angelegter Nutzer ist sofort login-fähig", async () => {
    const { app, headers } = await adminApp();
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Vip", email: "vip@x.de", password: "vippass12", role: "controller" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "vip@x.de", password: "vippass12" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().token).toBeTruthy();
  });

  it("fehlendes Passwort → ehrlicher 400 (kein 500)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "NoPw", email: "nopw@x.de", role: "experte" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("WEAK_PASSWORD");
  });

  it("Duplikat-E-Mail → ehrliche Meldung (409)", async () => {
    const { app, headers } = await adminApp();
    const p = { name: "Dup", email: "dup@x.de", password: "pass1234", role: "experte" };
    expect(
      (await app.inject({ method: "POST", url: "/api/users", headers, payload: p })).statusCode,
    ).toBe(201);
    const again = await app.inject({ method: "POST", url: "/api/users", headers, payload: p });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("EMAIL_TAKEN");
  });

  it("ungültige Rolle → 400 (nicht mehr still übernommen)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "X", email: "x@x.de", password: "pass1234", role: "kaputt" },
    });
    expect(res.statusCode).toBe(400);
  });

  // gesamt-nutzerverwaltung (R-0518 / FR-RBAC-02): Anlage und Rollenänderung über HTTP stehen je
  // mit dem Admin als Handelndem und dem Konto als Ziel im Protokoll — gelesen über GET /api/audit.
  it("Anlage und Rollenänderung am Draht: je ein Protokolleintrag mit dem Admin als Handelndem", async () => {
    const { app, headers } = await adminApp();
    const ich = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    expect(ich.statusCode).toBe(200);
    const adminId = ich.json().id as string;

    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Pro", email: "pro@x.de", password: "propass12", role: "experte" },
    });
    expect(res.statusCode).toBe(201);
    const neuId = res.json().id as string;
    const protokoll = async (action: string) =>
      (
        await app.inject({
          method: "GET",
          url: `/api/audit?action=${action}&target=${neuId}`,
          headers,
        })
      ).json() as { actor: string; payload: Record<string, unknown> }[];

    const anlage = await protokoll("user.created");
    expect(anlage).toHaveLength(1);
    expect(anlage[0]?.actor).toBe(adminId);
    expect(anlage[0]?.payload.via).toBe("admin");

    const rolle = await app.inject({
      method: "PUT",
      url: `/api/users/${neuId}`,
      headers,
      payload: { role: "controller" },
    });
    expect(rolle.statusCode, rolle.body).toBeLessThan(300);
    const wechsel = await protokoll("user.role-change");
    expect(wechsel).toHaveLength(1);
    expect(wechsel[0]?.actor).toBe(adminId);
    expect(wechsel[0]?.payload.role).toBe("controller");
  });

  it("Nicht-Admin → abgelehnt", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "X", email: "x@x.de", password: "pass1234" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });
});
