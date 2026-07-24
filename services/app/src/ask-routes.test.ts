import { describe, expect, it } from "vitest";
import { ModelCapacityError } from "../../reasoner";
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

  it("Helpful erhöht Trust nachvollziehbar (+2); unbelegte KO-ID wird abgewiesen", async () => {
    const { app, headers } = await adminApp();
    const koId = await createKo(app, headers); // unbewertet → Trust 0

    // FUNKE-FIX P0 (bens ROT-1): das „Danke" verlangt den Answer-Receipt aus einem echten
    // Antwortvorgang. Wir fragen passend zum KO, damit die Antwort GENAU dieses KO ausliefert.
    const answer = await ask(app, headers, "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?");
    expect(answer.json().result.sources).toContain(koId);
    const receipt = answer.json().receipt as string;

    const helpful = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers,
      payload: { koId, receipt },
    });
    expect(helpful.statusCode).toBe(204);

    const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    expect(ko.json().trust).toBe(2); // FR-ASK-04: +2

    // Unbelegte/fremd gewählte KO-ID (gültiger Receipt, aber anderes KO) → 403 (nicht wirksam).
    const unbelegt = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers,
      payload: { koId: "does-not-exist", receipt },
    });
    expect(unbelegt.statusCode).toBe(403);
    // Auch ganz ohne Receipt → 403.
    const noReceipt = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers,
      payload: { koId },
    });
    expect(noReceipt.statusCode).toBe(403);
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

// FUNKE-FIX2 P0 (bens Blocker Gap-Freitext): der Wissenslücken-FREITEXT wird end-to-end
// adressatengerecht behandelt — /api/gaps/summary liefert NUR Zahlen; /api/gaps redigiert den
// Fragetext für Unberechtigte und zeigt ihn Ersteller/Assignee/Detail-Rolle.
describe("FUNKE-FIX2 P0: Wissenslücken-Freitext adressatengerecht (HTTP)", () => {
  async function loginToken(
    app: ReturnType<typeof buildApp>,
    email: string,
  ): Promise<{ headers: Record<string, string>; id: string }> {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    return { headers: { authorization: `Bearer ${login.json().token}` }, id: login.json().user.id };
  }

  // Admin (Bootstrap) legt einen experten + einen weiteren experten an; erzeugt über eine
  // unbeantwortbare Frage als EXPERTE-1 eine Lücke (createdBy = experte-1).
  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    const admin = await loginToken(app, "admin@x.de");
    for (const [name, email] of [
      ["Ex1", "ex1@x.de"],
      ["Ex2", "ex2@x.de"],
    ]) {
      await app.inject({
        method: "POST",
        url: "/api/users",
        headers: admin.headers,
        payload: { name, email, password: "secret123", role: "experte" },
      });
    }
    const ex1 = await loginToken(app, "ex1@x.de");
    const ex2 = await loginToken(app, "ex2@x.de");
    const question = "Wie kalibriere ich das Quantenflux Aggregat ZZZ?";
    const asked = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: ex1.headers,
      payload: { question },
    });
    const gapId = asked.json().gap.id as string;
    return { app, admin, ex1, ex2, question, gapId };
  }

  it("/api/gaps/summary liefert nur Zahlen, KEINEN Fragetext", async () => {
    const { app, ex2, question } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/gaps/summary", headers: ex2.headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.open).toBe(1);
    expect(body.byPriority).toEqual({ hoch: 0, mittel: 1, niedrig: 0 });
    expect(res.payload).not.toContain(question);
    expect(res.payload).not.toContain("Quantenflux");
  });

  it("/api/gaps: Unberechtigter (fremder Experte) → redigiert, KEIN Fragetext, kein createdBy", async () => {
    const { app, ex2, question } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/gaps", headers: ex2.headers });
    expect(res.statusCode).toBe(200);
    const gaps = res.json();
    expect(gaps).toHaveLength(1);
    expect(gaps[0].question).toBe("");
    expect(gaps[0].redacted).toBe(true);
    expect("createdBy" in gaps[0]).toBe(false);
    expect(res.payload).not.toContain(question);
  });

  it("/api/gaps: Ersteller (createdBy) → Volltext", async () => {
    const { app, ex1, question } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/gaps", headers: ex1.headers });
    const gaps = res.json();
    expect(gaps[0].question).toBe(question);
    expect(gaps[0].redacted).toBeUndefined();
  });

  it("/api/gaps: Detail-Rolle (Admin, ko.validate) → Volltext", async () => {
    const { app, admin, question } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/gaps", headers: admin.headers });
    const gaps = res.json();
    expect(gaps[0].question).toBe(question);
  });
});

// SCRUM-498 B1 (ben-Review): bewusste Eingabe-Härtung von POST /api/ask über die GÜLTIGE HÜLLE eines
// Requests: Body MUSS ein JSON-Objekt sein; question optional (string ≤ 8.000 Codepoints, fehlt/leer/
// null → Handler "" → 200 wie Parent); locale optional (string/skalar-coercierbar, Handler normalisiert
// de/en); additionalProperties erlaubt; Gesamt-Body ≤ 128 KiB. Alles außerhalb → kontrolliertes 400
// (413 bei Größe), nie 500. Session-Guard in preValidation (401 vor Schema), Add-on-Pfad unverändert
// (401/403 im onRequest-Hook).
describe("SCRUM-498 B1: /api/ask Eingabe-Härtung (gültige Hülle)", () => {
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

  it("Parent-Verhalten: {} → 200 und {question:''} → 200 (leere/fehlende Frage bleibt zulässig)", async () => {
    const { app, headers } = await adminApp();
    expect(
      (await app.inject({ method: "POST", url: "/api/ask", headers, payload: {} })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: "POST", url: "/api/ask", headers, payload: { question: "" } }))
        .statusCode,
    ).toBe(200);
  });

  it("Unterschied kein-Body (400, Crash-Fix) vs. {} (200)", async () => {
    const { app, headers } = await adminApp();
    const noBody = await app.inject({ method: "POST", url: "/api/ask", headers });
    expect(noBody.statusCode).toBe(400);
    expect(noBody.payload).not.toContain("TypeError");
    expect(noBody.payload).not.toContain("Cannot read");
    expect(
      (await app.inject({ method: "POST", url: "/api/ask", headers, payload: {} })).statusCode,
    ).toBe(200);
  });

  it("gültige kurze Frage → 200 (kein minLength)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Was ist X?" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("escaped-Unicode-Frage ≤8.000 Codepoints, roh > 64 KiB → 200 (bens ROT-2, passt bei 128 KiB)", async () => {
    const { app, headers } = await adminApp();
    // 6.000 😀-Codepoints als Surrogatpaar-Escapes → roh ~70 KiB, aber nur 6.000 Codepoints (≤ 8.000).
    // Als ROHER JSON-String gesendet (JSON.stringify eines Objekts würde raw-UTF-8 ~23 KiB erzeugen).
    const body = `{"question":"${"\\uD83D\\uDE00".repeat(6000)}"}`;
    expect(Buffer.byteLength(body)).toBeGreaterThan(64 * 1024); // bei 64 KiB wäre das ein 413 gewesen
    expect(Buffer.byteLength(body)).toBeLessThan(128 * 1024);
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { ...headers, "content-type": "application/json" },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
  });

  it("kurze Frage + großes Zusatzfeld knapp unter 128 KiB → 200 (additionalProperties bleibt)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Was ist X?", extra: "a".repeat(120 * 1024) }, // ~120 KiB < 128 KiB
    });
    expect(res.statusCode).toBe(200);
  });

  it("Frage > 8.000 Zeichen → 400 (Kosten-Cap)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "a".repeat(8_001) },
    });
    expect(res.statusCode).toBe(400);
  });

  it("Body > 128 KiB → 413 (milder Transport-Cap, kein 500)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "a".repeat(200_000) },
    });
    expect(res.statusCode).toBe(413);
  });

  it("Oracle: anonym → 401 vor der Schema-Validierung (auch bei Frage > 8.000)", async () => {
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
    // Schema-invalider Body wird für anon erst nach dem 401 relevant (Reorder greift).
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/ask",
          payload: { question: "a".repeat(8_001) },
        })
      ).statusCode,
    ).toBe(401);
  });

  it("locale nicht-coercierbar (Objekt) → 400 (bewusste Härtung, Teil der gültigen Hülle)", async () => {
    // locale ist string oder skalar-coercierbar; ein Objekt liegt außerhalb der gültigen Hülle → 400,
    // kontrolliert (kein 500). Session gültig, damit der 400 aus der Schema-Validierung stammt.
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Was ist X?", locale: { x: 1 } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.payload).not.toContain("TypeError");
  });

  it("nicht-objektförmiger Top-Level-Body (JSON-Array) → 400 (Teil der gültigen Hülle)", async () => {
    // Der Body MUSS ein JSON-Objekt sein; ein Array/Skalar auf Top-Level liegt außerhalb → 400,
    // kontrolliert (kein 500).
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: [1, 2],
    });
    expect(res.statusCode).toBe(400);
    expect(res.payload).not.toContain("TypeError");
  });
});

// SCRUM-498 B2: Läuft der prozess-globale Modell-Cap über (Warteschlange voll / Acquire-Timeout), wirft
// der Chokepoint einen ModelCapacityError. reasoner.answer reicht ihn durch (kein deterministischer
// Fallback), der globale setErrorHandler mappt ihn auf 503 + Retry-After. Hier über die echte POST
// /api/ask-Route, mit einem ask-Service, dessen ask() den Backpressure-Fehler stellvertretend wirft.
describe("SCRUM-498 B2: /api/ask bei Modell-Cap-Überlauf → 503 + Retry-After (kein 500)", () => {
  it("ask() wirft ModelCapacityError → globaler Handler mappt auf 503 + Retry-After (MODEL_BUSY)", async () => {
    const services = buildServices();
    // Nur ask.ask ist relevant (POST /api/ask ruft ausschließlich diese Methode); Backpressure wird
    // stellvertretend geworfen. Property auf unknown gecastet, um die volle AskService-Form zu umgehen.
    (services as unknown as { ask: unknown }).ask = {
      ask: async () => {
        throw new ModelCapacityError("Modell ausgelastet.");
      },
    };
    const app = buildApp(services);
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
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Wie entlüfte ich die Pumpe?" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.json().error).toBe("MODEL_BUSY");
    expect(res.payload).not.toContain("ModelCapacityError"); // kein Stacktrace nach außen
  });
});
