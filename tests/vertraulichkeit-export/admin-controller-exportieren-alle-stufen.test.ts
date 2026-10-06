import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// R-0633 — „Admin und Controller dürfen auch validierte vertrauliche und streng vertrauliche Texte
// exportieren."
//
// WAS SCHON GEPINNT WAR UND WAS NICHT. `tests/security/library-export-egress.test.ts` misst die
// Rollenbindung der Route mit EINEM Berechtigten (admin) und EINER Stufe („vertraulich"). Der Satz
// aus R-0633 nennt aber ZWEI Rollen und ZWEI Stufen. Hier stehen deshalb genau die beiden fehlenden
// Hälften: Controller neben Admin, „streng vertraulich" neben „vertraulich" — und als Gegenprobe der
// Experte, der weder das eine noch das andere bekommt. Gemessen über die echte Route
// (`GET /api/library/export`, `library-routes.ts`: `includeConfidential = can(role, "ko.validate")`).
//
// NICHT HIER: die externe KI. R-0633 sagt ausdrücklich, sie „folgt ihrer eigenen Freigaberegel" —
// der Export ist kein KI-Weg, und diese Datei behauptet über KI-Aufrufe nichts.
async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "r0633-admin@x.de", password: "secret123" },
  });
  const anmelden = async (email: string) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    return { authorization: `Bearer ${res.json().token}` };
  };
  const admin = await anmelden("r0633-admin@x.de");
  for (const role of ["controller", "experte"] as const) {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: role, email: `r0633-${role}@x.de`, password: "secret123", role },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
  }

  const ko = services.ko;
  const anlegen = async (title: string) =>
    ko.create({
      title,
      statement: `${title} — Kerntext.`,
      type: "best_practice",
      category: "Anlage 1",
      author: "admin",
      tags: [],
    });
  const offen = await anlegen("Ventil entlasten");
  await ko.setValidationState(offen.id, { trust: 80, status: "validiert" });
  const vertraulich = await anlegen("Schichtplan Leitwarte");
  await ko.setValidationState(vertraulich.id, { trust: 80, status: "validiert" });
  await ko.setConfidentiality(vertraulich.id, "vertraulich", "admin");
  const streng = await anlegen("Notabschaltung Reaktor B");
  await ko.setValidationState(streng.id, { trust: 80, status: "validiert" });
  await ko.setConfidentiality(streng.id, "streng_vertraulich", "admin");
  // Streng vertraulich, aber NICHT validiert: Validiert-only gilt auch für Berechtigte.
  const roh = await anlegen("Roher Entwurf Notabschaltung");
  await ko.setConfidentiality(roh.id, "streng_vertraulich", "admin");

  return {
    app,
    admin,
    controller: await anmelden("r0633-controller@x.de"),
    experte: await anmelden("r0633-experte@x.de"),
  };
}

async function exportTitel(
  app: Awaited<ReturnType<typeof aufbau>>["app"],
  headers: Record<string, string>,
): Promise<string[]> {
  const res = await app.inject({ method: "GET", url: "/api/library/export", headers });
  expect(res.statusCode).toBe(200);
  return (res.json() as { title: string }[]).map((k) => k.title).sort();
}

describe("R-0633 · Export validierter vertraulicher und streng vertraulicher Texte", () => {
  for (const rolle of ["admin", "controller"] as const) {
    it(`${rolle}: beide Stufen sind im Export — nicht-validiert bleibt draußen`, async () => {
      const ctx = await aufbau();
      expect(await exportTitel(ctx.app, ctx[rolle])).toEqual([
        "Notabschaltung Reaktor B",
        "Schichtplan Leitwarte",
        "Ventil entlasten",
      ]);
    });
  }

  it("GEGENPROBE experte: keine der beiden vertraulichen Stufen im Export", async () => {
    const ctx = await aufbau();
    expect(await exportTitel(ctx.app, ctx.experte)).toEqual(["Ventil entlasten"]);
  });

  it("controller, Textformat: der streng vertrauliche Titel steht auch im Markdown", async () => {
    const ctx = await aufbau();
    const md = await ctx.app.inject({
      method: "GET",
      url: "/api/library/export?format=markdown",
      headers: ctx.controller,
    });
    expect(md.statusCode).toBe(200);
    expect(md.body).toContain("Notabschaltung Reaktor B");
    expect(md.body).not.toContain("Roher Entwurf Notabschaltung");
  });
});
