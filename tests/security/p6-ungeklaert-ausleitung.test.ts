import { expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

it("P6 · echter Outputweg lässt ausdrücklich intern zu und erfindet für ungeklärten Bestand keine Freigabe", async () => {
  const services = buildServices();
  const app = buildApp(services);
  try {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { name: "Admin", email: "admin@p6.test", password: "secret123" },
        })
      ).statusCode,
    ).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@p6.test", password: "secret123" },
    });
    expect(login.statusCode).toBe(200);
    const headers = { authorization: `Bearer ${login.json().token}` };
    const author = (await app.inject({ url: "/api/auth/me", headers })).json().id as string;
    const basis = { author, type: "best_practice" as const, category: "P6" };
    const intern = await services.ko.create({
      ...basis,
      title: "INTERN-POSITIV",
      statement: "INTERN-POSITIV darf als Quelle dienen.",
      confidentiality: "intern",
    });
    const ungeklart = await services.ko.create({
      ...basis,
      title: "UNGEKLAERT-GESCHUETZT",
      statement: "UNGEKLAERT-GESCHUETZT bleibt ohne Ausleitungsfreigabe.",
    });
    expect(intern.confidentiality).toBe("intern");
    expect(Object.hasOwn(ungeklart, "confidentiality")).toBe(false);
    for (const k of [intern, ungeklart]) {
      await services.ko.setValidationState(k.id, { status: "validiert", trust: 99 });
    }
    const positiv = await app.inject({
      method: "POST",
      url: "/api/output/generate",
      headers,
      payload: { kind: "checklist", koIds: [intern.id] },
    });
    expect(positiv.statusCode, positiv.body).toBe(200);
    expect(positiv.json().markdown).toContain("INTERN-POSITIV");
    const geschlossen = await app.inject({
      method: "POST",
      url: "/api/output/generate",
      headers,
      payload: { kind: "checklist", koIds: [ungeklart.id] },
    });
    expect(geschlossen.statusCode).toBeGreaterThanOrEqual(400);
    expect(geschlossen.json().error).toBe("CONFIDENTIAL");
    expect(geschlossen.body).not.toContain("UNGEKLAERT-GESCHUETZT");
    const weiterhinUngeklart = await services.ko.get(ungeklart.id);
    expect(Object.hasOwn(weiterhinUngeklart ?? {}, "confidentiality")).toBe(false);
  } finally {
    await app.close();
  }
});
