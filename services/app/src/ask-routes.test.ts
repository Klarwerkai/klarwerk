import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { ModelCapacityError } from "../../reasoner";
import { buildApp, buildServices } from "./build-app";
import { askRoutes } from "./routes/ask-routes";

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

// ================================================================================================
// KW-KA4 — EINWILLIGUNG JE DOKUMENT: DER SERVERSEITIGE SICHERHEITSVERTRAG
// ================================================================================================
//
// PEDIS WEICHE, wörtlich aus dem Werkstattbeschluss vom 18.08.2026: „Externe KI mit Dokumenttext:
// JA, aber nie still. Je Dokument eine ausdrückliche Einwilligung … Vertraulich Markiertes bleibt
// IMMER draußen."
//
// DIE ABNAHME steht wörtlich in `OFFEN.md:64` (KA4) und ist eine Bytegleich-Zusage, keine Funktion:
//
//     „Gebaut, wenn: ohne Einwilligung verhält sich der Server bytegleich wie heute (Red-first-Test)"
//
// Genau deshalb steht der SNAPSHOT hier zuerst und ist der wichtigste Fall der Datei: Er misst den
// vollständigen Optionssatz, mit dem die Route heute in `AskService.ask` geht, und friert ihn ein.
// Nach dem Bau muss er unverändert sein. Ein Sicherheitsbau, der die bestehende Enge auch nur um
// ein Feld lockert, ist gescheitert — auch wenn alle neuen Fälle grün sind.
//
// WARUM DER OPTIONSSATZ UND NICHT NUR DIE ANTWORT: Die Antwort ist eine Ableitung; die Optionen
// SIND die Sicherheitsgrenze (`validatedOnly` → nur validierte KOs, `retrievalOnly` → kein
// Modell-/Embedderaufruf, `gapPolicy` → keine Nebenwirkung). Ein Test, der nur die Antwort
// vergleicht, wäre auch dann grün, wenn die Enge fiele und der deterministische Pfad zufällig
// dasselbe liefert.
describe("KW-KA4 · Ohne Einwilligung bleibt der Server bytegleich", () => {
  const INSTANZ = "ka4-instanz-1";
  const DESCRIPTOR = { kind: "saved" as const, hostDocumentId: "ka4-word-doc-1" };

  /**
   * Ein Spion auf `AskService.ask` — die einzige Stelle, an der die Sicherheitsoptionen wirklich
   * ankommen. Er hüllt den echten Dienst ein und verändert nichts: gemessen wird der PRODUKTIVE
   * Aufruf, nicht ein Nachbau.
   */
  function mitSpion() {
    const services = buildServices();
    const gesehen: { question: string; actor: string; locale: string; opts: unknown }[] = [];
    const echt = services.ask.ask.bind(services.ask);
    services.ask.ask = (async (
      question: string,
      actor?: string,
      locale?: string,
      opts?: unknown,
    ) => {
      gesehen.push({ question, actor: actor ?? "", locale: locale ?? "", opts: opts ?? null });
      return echt(question, actor, locale as never, opts as never);
    }) as typeof services.ask.ask;
    return { app: buildApp(services), gesehen };
  }

  async function adminHeaders(app: ReturnType<typeof buildApp>) {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "ka4@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ka4@x.de", password: "secret123" },
    });
    return { authorization: `Bearer ${login.json().token}`, "x-klara-instance": INSTANZ };
  }

  /** Die echte, serverseitig registrierte Sitzung — der Server vergibt die documentContextId. */
  async function klaraSitzung(app: ReturnType<typeof buildApp>, auth: Record<string, string>) {
    const res = await app.inject({
      method: "POST",
      url: "/api/klara/sessions",
      headers: auth,
      payload: { addinInstanceId: INSTANZ, documentDescriptor: DESCRIPTOR },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Klara-Sitzung nicht angelegt: ${res.statusCode} ${res.body}`);
    }
    const body = res.json();
    return {
      sessionId: body.sessionId as string,
      documentContextId: body.documentContextId as string,
      headers: {
        ...auth,
        "x-klara-session": body.sessionId as string,
        "x-klara-document": body.documentContextId as string,
      },
    };
  }

  it("KA4-S1 (SNAPSHOT): der Klara-Ask ohne Einwilligung trägt exakt validatedOnly + retrievalOnly", async () => {
    const { app, gesehen } = mitSpion();
    const auth = await adminHeaders(app);
    const sitzung = await klaraSitzung(app, auth);

    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: sitzung.headers,
      payload: { question: "Wie entlüfte ich die Pumpe?", mode: "retrieval-only" },
    });

    expect(res.statusCode).toBe(200);
    expect(gesehen).toHaveLength(1);
    // DER EINGEFRORENE SATZ. `toEqual` und nicht `toMatchObject`: ein zusätzliches Feld wäre
    // ebenfalls eine Verhaltensänderung und muss auffallen.
    // JOB 1591 D2 (Auflage 3): Der Satz hat ein drittes Glied bekommen — den Betrachterfilter des
    // Session-Panel-Wegs. Die `toEqual`-Schärfe bleibt: ein VIERTES Feld fällt weiterhin auf, und
    // ein nicht-funktionaler Wert an dieser Stelle macht den Fall rot. Begründung am ENGE-Block.
    expect(gesehen[0]?.opts).toEqual({
      validatedOnly: true,
      retrievalOnly: true,
      ungeprueftSichtbarFuer: expect.any(Function),
      // JOB 2626 D3: das vierte Glied (Torlage-Betrachter); ein FUENFTES faellt weiterhin auf.
      verschlossenSichtbarFuer: expect.any(Function),
    });
  });

  it("KA4-S2 (SNAPSHOT): dieselbe Enge auch mit gesendeten, aber nicht eingewilligten Klara-Kopfzeilen", async () => {
    // Die Kopfzeilen allein sind KEINE Autorisierung. Sie zu senden darf die Optionen nicht
    // verändern — sonst wäre der Transport selbst die Freigabe.
    const { app, gesehen } = mitSpion();
    const auth = await adminHeaders(app);
    const sitzung = await klaraSitzung(app, auth);

    await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: sitzung.headers,
      payload: { question: "Wie entlüfte ich die Pumpe?", mode: "retrieval-only" },
    });
    expect(gesehen[0]?.opts).toEqual({
      validatedOnly: true,
      retrievalOnly: true,
      ungeprueftSichtbarFuer: expect.any(Function),
      // JOB 2626 D3: das vierte Glied (Torlage-Betrachter); ein FUENFTES faellt weiterhin auf.
      verschlossenSichtbarFuer: expect.any(Function),
    });
  });

  it("KA4-S3: ein Consent-Versuch ohne externe Auflösung wird abgelehnt — der Bestand kennt keinen externen Modus", async () => {
    // Der Grund steht in `services/reasoner/src/klara-policy.ts:161`
    // (`KLARA_EXTERNAL_EXECUTION_MIGRATED = false`) und in `klara-session-service.ts:764-768`:
    // ohne verdrahteten Cloud-Anbieter ist der effektive Modus nicht `external`, und dann ist eine
    // Zustimmung gar nicht erteilbar. Dieser Fall hält den Ist-Zustand fest — er ist die
    // Voraussetzung dafür, dass KA4-S1/S2 überhaupt etwas beweisen: ohne ihn wäre „bytegleich"
    // auch dann grün, wenn die Freigabe schlicht nie erreichbar ist, ohne dass jemand es merkt.
    const { app } = mitSpion();
    const auth = await adminHeaders(app);
    const sitzung = await klaraSitzung(app, auth);

    const res = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${sitzung.sessionId}/consent`,
      headers: sitzung.headers,
    });
    expect(res.statusCode).toBe(409);
  });
});

// ================================================================================================
// KW-KA4 · DIE CONSENT- UND NEGATIVMATRIX AM ECHTEN ROUTENPFAD
// ================================================================================================
//
// WARUM HIER EIN INJIZIERTES TOR STEHT — und warum das kein Nachbau ist. Die Fälle oben fahren die
// vollständige App; sie können den POSITIVEN Pfad aber strukturell nicht erreichen, weil
// `KLARA_EXTERNAL_EXECUTION_MIGRATED` (`services/reasoner/src/klara-policy.ts:161`) auf `false`
// steht und jede externe Auflösung mit `external_not_migrated` blockiert. Fall KA4-S3 belegt das
// am Draht: der Consent-Versuch endet mit 409.
//
// Geprüft wird deshalb genau das, was diese Route selbst verantwortet: WIE sie auf die Antwort des
// Tors reagiert. Das Tor selbst ist Null-Diff-Pfad und in `klara-session-service.test.ts` eigens
// abgenommen; es hier nachzubauen wäre eine zweite Auslegung derselben Regel. `askRoutes` wird
// dafür direkt registriert — dasselbe Hausmuster wie `tests/security/mega76-schutz-erzwungen.test.ts`.
//
// DER ENTSCHEIDENDE PUNKT: Die Route darf NUR bei `erlaubt: true` lockern. Jede andere Antwort,
// jeder Fehler und jede fehlende Angabe muss in exakt demselben Optionssatz enden, den KA4-S1
// eingefroren hat.
describe("KW-KA4 · Nur eine gebundene, serverbestätigte Einwilligung lockert", () => {
  const BINDUNG = {
    "x-klara-session": "sess-1",
    "x-klara-instance": "inst-1",
    "x-klara-document": "doc-s-1",
  };

  /**
   * Eine minimale App mit genau dieser Route. `guards` gibt einen Sitzungsnutzer zurück; der
   * Ask-Dienst ist ein Spion, der den Optionssatz festhält, statt zu antworten.
   */
  async function routeMit(pruefer: unknown) {
    const gesehen: unknown[] = [];
    const ask = {
      ask: async (_q: string, _actor: string, _locale: string, opts?: unknown) => {
        gesehen.push(opts ?? null);
        return {
          result: {
            answered: false,
            knowledgeClass: "unbekannt",
            sources: [],
            citedSources: [],
            steps: [],
            answer: null,
            trust: 0,
          },
          gap: null,
        };
      },
    };
    const app = Fastify();
    app.register(
      askRoutes(
        {
          ask: ask as never,
          ko: { get: async () => undefined } as never,
          conflicts: { unresolved: async () => [] } as never,
          klaraSessions: pruefer as never,
        },
        {
          requireUser: async () => ({ id: "nutzer-1", role: "admin" }),
          requirePermission: async () => ({ id: "nutzer-1", role: "admin" }),
        } as never,
      ),
    );
    await app.ready();
    return { app, gesehen };
  }

  const frage = (app: FastifyInstance, headers: Record<string, string>) =>
    app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Wie entlüfte ich die Pumpe?", mode: "retrieval-only" },
    });

  // ==============================================================================================
  // JOB 1591 · D2 · AUFLAGE 3 — DER EINGEFRORENE SATZ WIRD GENAUER, NICHT WEICHER.
  // ==============================================================================================
  //
  // Der Satz stand bis D2 auf `{ validatedOnly, retrievalOnly }` und war mit `toEqual` gepinnt:
  // „ein zusaetzliches Feld waere ebenfalls eine Verhaltensaenderung und muss auffallen." ES IST
  // AUFGEFALLEN — genau so, wie es sollte, und deshalb steht dieser Block hier.
  //
  // W5 (JOB 1591 D1) reicht auf DIESEM Weg — und nur auf ihm — die fertige
  // Sichtbarkeitsentscheidung des Betrachters hinein. `expect.any(Function)` ist dabei KEINE
  // Aufweichung: `toEqual` bleibt `toEqual`, die Feldmenge bleibt exakt gepinnt, und ein VIERTES
  // Feld faellt weiterhin sofort auf. Was sich aendert, ist allein, dass der Satz jetzt drei
  // Glieder hat statt zwei — und dass das dritte eine Funktion sein MUSS. Ein `undefined`, ein
  // `true` oder ein weggelassenes Feld macht diese Faelle rot.
  //
  // WELCHER ZWEIG HIER GEPRUEFT WIRD, und das ist der Kern von Auflage 3: Jeder Fall in dieser
  // Datei faehrt `mode: "retrieval-only"` mit Sitzung (`frage()` oben, :649-655) — das ist der
  // SESSION-PANEL-WEG. Diese Datei kennt den Add-on-Zweig ueberhaupt nicht: eine Suche nach
  // `x-klarwerk-addon-key` findet hier null Treffer. Sein `toEqual` liegt in
  // `services/app/src/addon-principal.test.ts` und ist von D2 NICHT beruehrt worden.
  // Der ausfuehrbare Beleg dafuer, dass der Add-on-Zweig das Feld NICHT fuehrt, steht als eigener
  // Fall in `tests/app/w5-ungeprueft-gemeldet.test.ts` (W7) — belegt, nicht behauptet.
  const ENGE = {
    validatedOnly: true,
    retrievalOnly: true,
    ungeprueftSichtbarFuer: expect.any(Function),
    // JOB 2626 D3: viertes Glied — der Betrachterfilter der Torlage (`AskResult.verschlossen`).
    verschlossenSichtbarFuer: expect.any(Function),
  };

  it("KA4-P1: `erlaubt: true` für exakt diese Bindung → die Enge entfällt", async () => {
    let gesehenBindung: unknown = null;
    const { app, gesehen } = await routeMit({
      pruefeExterneAusfuehrung: async (sessionId: string, bindung: unknown) => {
        gesehenBindung = { sessionId, bindung };
        return { erlaubt: true };
      },
    });
    const res = await frage(app, BINDUNG);
    expect(res.statusCode).toBe(200);
    // Der normale Answerweg: KEINE erzwungenen Flags mehr.
    expect(gesehen[0]).toBe(null);
    // Und die Bindung wird VOLLSTÄNDIG durchgereicht — Sitzung UND Dokument, nicht nur eines.
    expect(gesehenBindung).toEqual({
      sessionId: "sess-1",
      bindung: { actorId: "nutzer-1", addinInstanceId: "inst-1", documentContextId: "doc-s-1" },
    });
    await app.close();
  });

  it("KA4-N1: `erlaubt: false` → unveränderte Enge", async () => {
    const { app, gesehen } = await routeMit({
      pruefeExterneAusfuehrung: async () => ({
        erlaubt: false,
        grund: "CONSENT_RECONFIRMATION_REQUIRED",
      }),
    });
    await frage(app, BINDUNG);
    expect(gesehen[0]).toEqual(ENGE);
    await app.close();
  });

  it("KA4-N2: fremde/abgelaufene Sitzung (Dienst wirft) → unveränderte Enge, kein 500", async () => {
    const { app, gesehen } = await routeMit({
      pruefeExterneAusfuehrung: async () => {
        throw new Error("NOT_FOUND");
      },
    });
    const res = await frage(app, BINDUNG);
    expect(res.statusCode).toBe(200);
    expect(gesehen[0]).toEqual(ENGE);
    await app.close();
  });

  it("KA4-N3: fehlende Kopfzeilen → gar keine Torbefragung, unveränderte Enge", async () => {
    let gefragt = 0;
    const { app, gesehen } = await routeMit({
      pruefeExterneAusfuehrung: async () => {
        gefragt += 1;
        return { erlaubt: true };
      },
    });
    // Jede der drei Angaben einzeln weggelassen — jede für sich muss die Freigabe verhindern.
    await frage(app, { "x-klara-instance": "inst-1", "x-klara-document": "doc-s-1" });
    await frage(app, { "x-klara-session": "sess-1", "x-klara-document": "doc-s-1" });
    await frage(app, { "x-klara-session": "sess-1", "x-klara-instance": "inst-1" });
    await frage(app, {});
    expect(gefragt, "ohne vollständige Bindung wird das Tor gar nicht erst gefragt").toBe(0);
    expect(gesehen).toEqual([ENGE, ENGE, ENGE, ENGE]);
    await app.close();
  });

  it("KA4-N4: leere Kopfzeilen zählen nicht als Bindung", async () => {
    let gefragt = 0;
    const { app, gesehen } = await routeMit({
      pruefeExterneAusfuehrung: async () => {
        gefragt += 1;
        return { erlaubt: true };
      },
    });
    await frage(app, {
      "x-klara-session": "  ",
      "x-klara-instance": "inst-1",
      "x-klara-document": "doc-s-1",
    });
    expect(gefragt).toBe(0);
    expect(gesehen[0]).toEqual(ENGE);
    await app.close();
  });

  it("KA4-N5: gar kein Tor verdrahtet → unveränderte Enge (mega76-Bauart)", async () => {
    const { app, gesehen } = await routeMit(undefined);
    await frage(app, BINDUNG);
    expect(gesehen[0]).toEqual(ENGE);
    await app.close();
  });

  it("KA4-N6: ein Client-Bool im Körper autorisiert NICHTS", async () => {
    // Der ausdrückliche No-Go des Auftrags: „kein clientseitiges Bool-Bypass".
    const { app, gesehen } = await routeMit({
      pruefeExterneAusfuehrung: async () => ({ erlaubt: false }),
    });
    await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: BINDUNG,
      payload: {
        question: "Wie entlüfte ich die Pumpe?",
        mode: "retrieval-only",
        externalConsentGranted: true,
        consent: true,
        allowExternal: true,
      },
    });
    expect(gesehen[0]).toEqual(ENGE);
    await app.close();
  });

  it("KA4-N7: eine kaputte Torantwort ohne `erlaubt` gilt als NEIN", async () => {
    const { app, gesehen } = await routeMit({ pruefeExterneAusfuehrung: async () => ({}) });
    await frage(app, BINDUNG);
    expect(gesehen[0]).toEqual(ENGE);
    await app.close();
  });
});
