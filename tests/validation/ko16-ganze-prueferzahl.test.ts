import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const INHALT = {
  title: "Fiktiver KO16-Prüfbeitrag",
  statement: "Die Prüferanzahl bleibt eine ganze Zahl.",
  type: "best_practice" as const,
  category: "Anlage 2",
  confidentiality: "intern" as const,
};

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  try {
    const registriert = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "KO16 Admin", email: "admin@ko16.test", password: "Fiktiv-KO16-123!" },
    });
    expect(registriert.statusCode).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@ko16.test", password: "Fiktiv-KO16-123!" },
    });
    expect(login.statusCode).toBe(200);
    const headers = { authorization: `Bearer ${login.json().token}` };
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    expect(me.statusCode).toBe(200);
    return { app, services, headers, autor: me.json().id as string };
  } catch (fehler) {
    await app.close();
    throw fehler;
  }
}

describe("KO16: ganze Prüferanzahl an der bestehenden Domänengrenze", () => {
  it("weist Bruchteile per HTTP und NaN am echten Dienst ohne Bestandsänderung ab", async () => {
    const { app, services, headers, autor } = await setup();
    try {
      const bestand = JSON.stringify(await services.ko.list());
      expect(bestand).toBe("[]");
      for (const neededValidations of [1.5, 4.5, 0, 6]) {
        const antwort = await app.inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: { ...INHALT, neededValidations },
        });
        expect(antwort.statusCode).toBe(400);
        expect(antwort.json().error).toBe("INVALID_NEEDED");
        expect(JSON.stringify(await services.ko.list())).toBe(bestand);
      }
      // NaN/Infinity sind keine JSON-Zahlen: diese Werte gehen direkt an den normalen Dienst.
      for (const neededValidations of [
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ]) {
        await expect(
          services.ko.create({ ...INHALT, author: autor, neededValidations }),
        ).rejects.toMatchObject({ name: "KoError", code: "INVALID_NEEDED" });
        expect(JSON.stringify(await services.ko.list())).toBe(bestand);
      }
    } finally {
      await app.close();
    }
  });

  it("erhält ganze Werte 1–5 sowie vorhandene Defaults und expliziten Vorrang im GET-Readback", async () => {
    const { app, headers } = await setup();
    try {
      const anlegenUndLesen = async (
        title: string,
        angabe: { neededValidations?: number | null },
        erwartet: number,
      ) => {
        const erstellt = await app.inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: { ...INHALT, title, ...angabe },
        });
        expect(erstellt.statusCode).toBe(201);
        expect(erstellt.json().neededValidations).toBe(erwartet);
        const gelesen = await app.inject({
          method: "GET",
          url: `/api/kos/${erstellt.json().id}`,
          headers,
        });
        expect(gelesen.statusCode).toBe(200);
        expect(gelesen.json().neededValidations).toBe(erwartet);
      };
      await anlegenUndLesen("Moduldefault", {}, 3);
      const gesetzt = await app.inject({
        method: "PUT",
        url: "/api/validation/settings",
        headers,
        payload: { defaultNeededValidations: 2 },
      });
      expect(gesetzt.statusCode).toBe(200);
      expect(gesetzt.json().defaultNeededValidations).toBe(2);
      await anlegenUndLesen("Adminvorgabe ohne Angabe", {}, 2);
      await anlegenUndLesen("Adminvorgabe bei null", { neededValidations: null }, 2);
      for (const neededValidations of [1, 2, 3, 4, 5]) {
        await anlegenUndLesen(
          `Explizit ${neededValidations}`,
          { neededValidations },
          neededValidations,
        );
      }
    } finally {
      await app.close();
    }
  });
});
