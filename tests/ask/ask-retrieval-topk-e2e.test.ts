import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-360 / AG-03 / FR-ASK-02 / NFR-PERF-03: Runtime-E2E über die ECHTEN HTTP-Routen. Bei vielen
// KOs + Störern bevorzugt die begrenzte, status-/trust-bewusste Top-K-Auswahl das relevante,
// VALIDIERTE KO; thematische Störer erscheinen NICHT als Quelle; ohne Treffer → ehrliche Lücke.
describe("SCRUM-360: Ask Top-K Retrieval (HTTP end-to-end)", () => {
  type App = ReturnType<typeof buildApp>;

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

  async function createKo(
    app: App,
    headers: Record<string, string>,
    title: string,
    statement: string,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { title, statement, type: "best_practice", category: "Ask", neededValidations: 1 },
    });
    return res.json().id as string;
  }

  const validate = (app: App, headers: Record<string, string>, id: string) =>
    app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });

  it("relevantes validiertes KO wird trotz vieler Störer als Quelle bevorzugt", async () => {
    const { app, headers } = await adminApp();

    // Viele thematisch unpassende Störer-KOs (teils validiert), die NICHT zur Frage passen.
    for (let i = 0; i < 40; i += 1) {
      const id = await createKo(
        app,
        headers,
        `Förderband FB${i} spannen`,
        `Riemen am Förderband FB${i} mit definierter Vorspannung montieren.`,
      );
      if (i % 2 === 0) {
        await validate(app, headers, id);
      }
    }

    // Zielwissen: validiert + zweite, inhaltsgleiche, OFFENE Variante (gleiche Relevanz).
    const target = await createKo(
      app,
      headers,
      "Spezialpresse SPX9 entlüften",
      "Vor dem Entlüften der Spezialpresse SPX9 den Hydraulikdruck vollständig ablassen.",
    );
    await validate(app, headers, target);
    await createKo(
      app,
      headers,
      "Spezialpresse SPX9 entlüften",
      "Vor dem Entlüften der Spezialpresse SPX9 den Hydraulikdruck vollständig ablassen.",
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Wie wird die Spezialpresse SPX9 entlüftet?" },
    });
    const body = res.json();
    expect(body.result.answered).toBe(true);
    expect(body.result.knowledgeClass).toBe("gesichert");
    expect(body.result.sources).toEqual([target]); // genau das validierte Ziel-KO, kein Störer
    expect(body.gap).toBeNull();
  });

  it("ohne thematischen Treffer entsteht trotz großem Bestand eine ehrliche Wissenslücke", async () => {
    const { app, headers } = await adminApp();
    for (let i = 0; i < 30; i += 1) {
      await createKo(
        app,
        headers,
        `Filter F${i} wechseln`,
        `Filter F${i} vierteljährlich tauschen.`,
      );
    }
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Wie hoch ist der aktuelle Wechselkurs?" },
    });
    const body = res.json();
    expect(body.result.answered).toBe(false);
    expect(body.result.sources).toEqual([]);
    expect(body.gap).not.toBeNull();
  });
});
