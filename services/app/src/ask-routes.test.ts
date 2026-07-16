import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-242: Ask-/Fragen-Workflow über die ECHTEN HTTP-Routen absichern (kein Service-Direktaufruf,
// keine Repo-Manipulation). Frage via POST /api/ask (ko.read) → { result: AnswerResult, gap }.
// Der deterministische Reasoner antwortet, wenn die Frage ein Stichwort (Token-Länge >2) mit einem
// KO teilt; ohne Treffer → answered=false → ehrliche Wissenslücke (Gap). Helpful via POST /api/ask/
// helpful (Trust +2, gedeckelt). Bewusst OHNE Demo-Seed, damit das Matching kontrollierbar ist.
describe("SCRUM-242: Ask-Workflow (HTTP end-to-end)", () => {
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
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Zylinderkopfdichtung XQ42 wechseln",
        statement: "Die Zylinderkopfdichtung XQ42 vor dem Wechsel entlasten.",
        type: "best_practice",
        category: "Ask",
        neededValidations: 1,
        ...overrides,
      },
    });
    return res.json().id as string;
  }

  const ask = (
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
    question: string,
  ) => app.inject({ method: "POST", url: "/api/ask", headers, payload: { question } });

  it("Frage mit passendem validiertem KO → strukturierte Antwort mit Quelle, keine Gap", async () => {
    const { app, headers } = await adminApp();
    const koId = await createKo(app, headers);
    // Über echte HTTP-Bewertung validieren (needed=1 → ein Admin-Up genügt) → Trust 100.
    await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });

    const res = await ask(app, headers, "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.answered).toBe(true);
    expect(body.result.sources).toContain(koId);
    expect(body.result.knowledgeClass).toBe("gesichert"); // validiertes KO
    expect(typeof body.result.answer).toBe("string");
    expect(body.result.steps.length).toBeGreaterThanOrEqual(1);
    expect(body.gap).toBeNull(); // beantwortet → keine Lücke

    // Keine Gap angelegt.
    const gaps = await app.inject({ method: "GET", url: "/api/gaps", headers });
    expect(gaps.json()).toHaveLength(0);
  });

  it("unbeantwortbare Frage → ehrliche Wissenslücke (Gap) wird erzeugt und gelistet", async () => {
    const { app, headers } = await adminApp(); // leerer Bestand → keine Quelle matcht

    const question = "Wie kalibriere ich das Quantenflux Aggregat ZZZ?";
    const res = await ask(app, headers, question);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.answered).toBe(false);
    expect(body.result.sources).toHaveLength(0);
    expect(body.gap).not.toBeNull();
    expect(body.gap.status).toBe("offen");
    expect(body.gap.question).toBe(question);

    // Lücke ist über die echte Route auffindbar.
    const gaps = await app.inject({ method: "GET", url: "/api/gaps", headers });
    expect(gaps.json().some((g: { question: string }) => g.question === question)).toBe(true);
  });

  it("Helpful erhöht Trust nachvollziehbar (+2); unbekanntes KO wird abgewiesen", async () => {
    const { app, headers } = await adminApp();
    const koId = await createKo(app, headers); // unbewertet → Trust 0

    const helpful = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers,
      payload: { koId },
    });
    expect(helpful.statusCode).toBe(204);

    const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    expect(ko.json().trust).toBe(2); // FR-ASK-04: +2

    // Unbekanntes KO → NOT_FOUND.
    const unknown = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers,
      payload: { koId: "does-not-exist" },
    });
    expect(unknown.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("Guard: anonym darf weder fragen noch Helpful markieren noch Gaps lesen", async () => {
    const { app } = await adminApp();
    expect(
      (await app.inject({ method: "POST", url: "/api/ask", payload: { question: "Hallo?" } }))
        .statusCode,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/ask/helpful",
          payload: { koId: "x" },
        })
      ).statusCode,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await app.inject({ method: "GET", url: "/api/gaps" })).statusCode,
    ).toBeGreaterThanOrEqual(400);
  });
});

// SCRUM-498 B1: Härtung der bestehenden Route POST /api/ask — Body-Schema (question maxLength 8.000,
// non-empty) + engeres bodyLimit (64 KiB). NO-OP für jeden heute-gültigen Request; nur Obergrenze +
// kontrolliertes 400/413 statt 500/TypeError-Leak. Session-Guard läuft jetzt in preValidation (401 vor
// der Schema-400), Add-on-Pfad unverändert (401/403 im onRequest-Hook).
describe("SCRUM-498 B1: /api/ask Body-Schema + bodyLimit", () => {
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

  it("gültige KURZE Frage → weiterhin 200 (keine 40er-Mindestlänge, NO-OP)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Was ist X?" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("question fehlt / nicht-coercierbarer Typ → 400 (Schema)", async () => {
    const { app, headers } = await adminApp();
    // Fehlt ganz → 400.
    expect(
      (await app.inject({ method: "POST", url: "/api/ask", headers, payload: {} })).statusCode,
    ).toBe(400);
    // Objekt/Array sind nicht zu string coercierbar → 400. (Skalare wie 123 coerct Fastifys ajv
    // per Default zu "123" — harmlos und kein heute-gültiger Request wird dadurch neu abgewiesen.)
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/ask",
          headers,
          payload: { question: { nested: "x" } },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/ask",
          headers,
          payload: { question: [1, 2] },
        })
      ).statusCode,
    ).toBe(400);
  });

  it("question > 8.000 Zeichen → 400", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "a".repeat(8_001) },
    });
    expect(res.statusCode).toBe(400);
  });

  it("Body über dem bodyLimit (64 KiB) → 413 (kontrolliert, kein 500)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "a".repeat(100_000) },
    });
    expect(res.statusCode).toBe(413);
  });

  it("fehlender/malformer Body → kontrolliertes 400, kein TypeError-Leak", async () => {
    const { app, headers } = await adminApp();
    const noBody = await app.inject({ method: "POST", url: "/api/ask", headers });
    expect(noBody.statusCode).toBe(400);
    expect(noBody.payload).not.toContain("TypeError");
    expect(noBody.payload).not.toContain("Cannot read");
    const malformed = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { ...headers, "content-type": "application/json" },
      payload: "{ kaputt",
    });
    expect(malformed.statusCode).toBe(400);
  });

  it("Oracle: anonym → 401 VOR der Body-400 (auch bei leerem Body)", async () => {
    const { app } = await adminApp();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/ask",
          payload: { question: "Was ist X?" },
        })
      ).statusCode,
    ).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/ask", payload: {} })).statusCode).toBe(
      401,
    );
  });
});
