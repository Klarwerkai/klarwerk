import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// Klara Stufe 2 (Pedi 05.07.): POST /api/help/explain — KI-Antwort AUSSCHLIESSLICH aus den
// mitgesandten Hilfe-Schnipseln. HTTP-E2E über die echte Route: Auth-Pflicht, ehrliche
// Eingabe-Validierung, Antwort-Shape; ohne Modell antwortet der deterministische Fallback
// (demo=true) — nie erfundene Inhalte, Quellen nur aus den Schnipsel-IDs.
describe("Klara Stufe 2: POST /api/help/explain", () => {
  async function setup() {
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
    const headers = { authorization: `Bearer ${login.json().token}` };
    return { app, headers };
  }

  const SNIPPETS = [
    {
      id: "page:validation",
      title: "Validierung",
      body: "Das Prüf-Board: Du bewertest eingereichtes Wissen. Erst mit genug grünen Freigaben gilt ein Objekt als validiert.",
    },
    {
      id: "cap:modes",
      title: "Die vier Wege",
      body: "Erzählen, Diktieren, Interview oder aus einer Datei — die KI strukturiert nur, du prüfst und reichst ein.",
    },
  ];

  it("verlangt Anmeldung (401 ohne Token)", async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/help/explain",
      payload: { question: "Wie validiere ich?", snippets: SNIPPETS },
    });
    expect(res.statusCode).toBe(401);
  });

  it("weist leere Frage und fehlende/ungültige Schnipsel ehrlich mit 400 ab", async () => {
    const { app, headers } = await setup();
    const noQuestion = await app.inject({
      method: "POST",
      url: "/api/help/explain",
      headers,
      payload: { question: "", snippets: SNIPPETS },
    });
    expect(noQuestion.statusCode).toBe(400);
    const noSnippets = await app.inject({
      method: "POST",
      url: "/api/help/explain",
      headers,
      payload: { question: "Wie validiere ich?", snippets: [] },
    });
    expect(noSnippets.statusCode).toBe(400);
    const badSnippet = await app.inject({
      method: "POST",
      url: "/api/help/explain",
      headers,
      payload: { question: "Wie validiere ich?", snippets: [{ id: "x", title: "", body: "b" }] },
    });
    expect(badSnippet.statusCode).toBe(400);
  });

  it("antwortet mit dem ehrlichen Antwort-Shape — Quellen nur aus den Schnipsel-IDs, demo ehrlich", async () => {
    const { app, headers } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/help/explain",
      headers,
      payload: {
        question: "Wie viele Freigaben braucht die Validierung?",
        snippets: SNIPPETS,
        locale: "de",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.answered).toBe("boolean");
    expect(Array.isArray(body.sources)).toBe(true);
    for (const src of body.sources) {
      expect(SNIPPETS.some((s) => s.id === src)).toBe(true);
    }
    // Ohne konfiguriertes Modell läuft der deterministische Fallback — als Demo erkennbar.
    expect(body.demo).toBe(true);
    if (body.answered) {
      expect(typeof body.answer).toBe("string");
      expect(body.answer.length).toBeGreaterThan(0);
    } else {
      expect(body.answer).toBeNull();
    }
  });
});
