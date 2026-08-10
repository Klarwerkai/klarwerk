import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";

// ================================================================================================
// W1 S4 R2 — DER HTTP-VERTRAG DER SIEBEN KLARA-ENDPUNKTE
// (KW-S4-04 §17-19, §63-69 · KW-S4-20 §5/§6 · korrigiert nach BEN ROT-5)
// ================================================================================================
//
// Gemessen wird über `app.inject()` gegen die ECHTE Kompositionswurzel — nicht gegen einen
// nachgebauten Fastify-Aufbau. Was hier grün ist, ist der Weg, den das Add-in wirklich geht.

/** SIEBEN Routen: der Dokument-Rebind aus S4-20 §5 ist in R2 dazugekommen. */
const PFADE = [
  { method: "GET" as const, url: "/api/klara/ai-status" },
  { method: "POST" as const, url: "/api/klara/sessions" },
  { method: "GET" as const, url: "/api/klara/sessions/beliebig" },
  { method: "POST" as const, url: "/api/klara/sessions/beliebig/consent" },
  { method: "DELETE" as const, url: "/api/klara/sessions/beliebig/consent" },
  { method: "POST" as const, url: "/api/klara/sessions/beliebig/close" },
  { method: "POST" as const, url: "/api/klara/sessions/beliebig/document-context" },
];

const INSTANZ = "instanz-1";
const DESCRIPTOR = { kind: "saved" as const, hostDocumentId: "word-doc-1" };

async function angemeldeteApp() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return {
    app,
    services,
    auth: { authorization: `Bearer ${login.json().token as string}` },
  };
}

/**
 * Eine registrierte Sitzung samt der SERVERSEITIG vergebenen `documentContextId`.
 *
 * Das ist die Korrektur aus S4-20 §4 in einer Zeile: der Client schickt einen Descriptor und
 * bekommt die Identität zurück — er wählt sie nicht.
 */
async function registriert(app: ReturnType<typeof buildApp>, auth: Record<string, string>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: auth,
    payload: { addinInstanceId: INSTANZ, documentDescriptor: DESCRIPTOR },
  });
  const body = res.json();
  return {
    res,
    sessionId: body.sessionId as string,
    documentContextId: body.documentContextId as string,
    headers: {
      ...auth,
      "x-klara-session": body.sessionId as string,
      "x-klara-instance": INSTANZ,
      "x-klara-document": body.documentContextId as string,
    },
  };
}

describe("W1 S4 R2 · alle sieben Endpunkte existieren und sind authentifiziert", () => {
  it("ANONYM: jeder der sieben verweigert mit 401", async () => {
    const { app } = await angemeldeteApp();
    for (const { method, url } of PFADE) {
      const res = await app.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
    await app.close();
  });

  it("ANGEMELDET, aber ohne gültige Zuordnung: gleichförmig verweigert — nie ein Routing-404", async () => {
    const { app, auth } = await angemeldeteApp();
    for (const { method, url } of PFADE) {
      const res = await app.inject({ method, url, headers: auth });
      // Jede Route ist registriert: sie antwortet mit unserem Domänenfehler, nicht mit Fastifys
      // Standardform. `beliebig` ist keine echte Sitzung, und ohne Descriptor fehlt der Body.
      expect([400, 404], `${method} ${url}`).toContain(res.statusCode);
      expect(["BAD_REQUEST", "NOT_FOUND"], `${method} ${url}`).toContain(res.json().error);
    }
    await app.close();
  });
});

// ================================================================================================
// BEN ROT-5 — der freie Status ist weg
// ================================================================================================

describe("W1 S4 R2 · ROT-5 · Status NUR gegen eine registrierte Zuordnung", () => {
  it("ohne die drei Header gibt es keinen Status mehr", async () => {
    // BENs Drahtgegenprobe: {"status":200,"instanceHeader":false,"documentHeader":false}.
    // Genau dieser Aufruf muss jetzt scheitern.
    const { app, auth } = await angemeldeteApp();
    const res = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers: auth });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NOT_FOUND");
    await app.close();
  });

  it("mit vollständiger, registrierter Zuordnung liefert er die Auflösung", async () => {
    const { app, auth } = await angemeldeteApp();
    const { headers } = await registriert(app, auth);
    const res = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
    expect(res.statusCode).toBe(200);
    for (const feld of [
      "resolutionId",
      "mode",
      "provider",
      "model",
      "adminConfiguredMode",
      "effectiveMode",
      "deviation",
      "deviationReason",
      "externalConsentRequired",
      "externalConsentGranted",
      "executionAllowed",
      "blockedReason",
      "resolvedAt",
      "expiresAt",
      "policyVersion",
      "configurationVersion",
    ]) {
      expect(res.json(), `Feld ${feld} fehlt`).toHaveProperty(feld);
    }
    expect(res.json().provider.length).toBeGreaterThan(0);
    expect(res.json().model.length).toBeGreaterThan(0);
    await app.close();
  });

  it("FREMDE Instanz oder fremdes Dokument im Statuskopf ⇒ dieselbe Absage", async () => {
    const { app, auth } = await angemeldeteApp();
    const { headers } = await registriert(app, auth);
    for (const fremd of [
      { ...headers, "x-klara-instance": "instanz-2" },
      { ...headers, "x-klara-document": "doc-s-fremd" },
      { ...headers, "x-klara-session": "gibt-es-nicht" },
    ]) {
      const res = await app.inject({
        method: "GET",
        url: "/api/klara/ai-status",
        headers: fremd,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("NOT_FOUND");
    }
    await app.close();
  });

  it("Header allein sind keine Attestierung: erfundene Werte ohne Registrierung tragen nicht", async () => {
    const { app, auth } = await angemeldeteApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/klara/ai-status",
      headers: {
        ...auth,
        "x-klara-session": "selbst-erfunden",
        "x-klara-instance": "selbst-erfunden",
        "x-klara-document": "selbst-erfunden",
      },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("der bestehende /api/reasoner/status bleibt unverändert (No-Go KW-S4-04 §54)", async () => {
    const { app, auth } = await angemeldeteApp();
    const alt = await app.inject({ method: "GET", url: "/api/reasoner/status", headers: auth });
    expect(alt.statusCode).toBe(200);
    for (const feld of ["resolutionId", "externalConsentRequired", "blockedReason"]) {
      expect(alt.json()).not.toHaveProperty(feld);
    }
    await app.close();
  });
});

// ================================================================================================
// S4-20 §4/§5 — Registrierung und Rebind über den Draht
// ================================================================================================

describe("W1 S4 R2 · Dokumentkontext wird registriert, nicht mitgeschickt", () => {
  it("POST /sessions liefert sessionId, documentContextId, resolutionId und expiresAt", async () => {
    const { app, auth } = await angemeldeteApp();
    const { res, documentContextId } = await registriert(app, auth);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.sessionId).toBeTruthy();
    expect(body.expiresAt).toBeTruthy();
    expect(body.resolution.resolutionId).toBeTruthy();
    // Die Identität kommt vom Server und ist nicht das Merkmal des Clients.
    expect(documentContextId).toMatch(/^doc-s-/);
    expect(documentContextId).not.toContain("word-doc-1");
    await app.close();
  });

  it("ohne documentDescriptor wird die Registrierung abgelehnt", async () => {
    const { app, auth } = await angemeldeteApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/klara/sessions",
      headers: auth,
      payload: { addinInstanceId: INSTANZ },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("BAD_REQUEST");
    await app.close();
  });

  it("ein ungespeichertes Dokument bekommt eine temporäre Id; der Rebind entwertet sie", async () => {
    const { app, auth } = await angemeldeteApp();
    const neu = await app.inject({
      method: "POST",
      url: "/api/klara/sessions",
      headers: auth,
      payload: {
        addinInstanceId: INSTANZ,
        documentDescriptor: { kind: "unsaved", clientDocumentNonce: "nonce-1" },
      },
    });
    const vorher = neu.json();
    expect(vorher.documentContextId).toMatch(/^doc-t-/);

    const headers = {
      ...auth,
      "x-klara-session": vorher.sessionId,
      "x-klara-instance": INSTANZ,
      "x-klara-document": vorher.documentContextId,
    };
    const rebind = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${vorher.sessionId}/document-context`,
      headers,
      payload: { documentDescriptor: DESCRIPTOR },
    });
    expect(rebind.statusCode).toBe(200);
    expect(rebind.json().documentContextId).toMatch(/^doc-s-/);
    expect(rebind.json().documentContextId).not.toBe(vorher.documentContextId);
    // Die alte Resolution ist entwertet — S4-20 §5 verlangt genau das.
    expect(rebind.json().resolution.resolutionId).not.toBe(vorher.resolution.resolutionId);

    // Und die alte Dokumentbindung trägt danach nicht mehr.
    const alt = await app.inject({
      method: "GET",
      url: `/api/klara/sessions/${vorher.sessionId}`,
      headers,
    });
    expect(alt.statusCode).toBe(404);
    await app.close();
  });
});

// ================================================================================================
// BEN ROT-2 — dieselbe Resolution über den Draht
// ================================================================================================

describe("W1 S4 R2 · ROT-2 · Status und Sitzung tragen DIESELBE resolutionId", () => {
  it("zwei Statusabrufe liefern dieselbe Identität — nicht bei jedem GET eine neue", async () => {
    const { app, auth } = await angemeldeteApp();
    const { headers } = await registriert(app, auth);
    const a = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
    const b = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
    expect(a.json().resolutionId).toBe(b.json().resolutionId);
    await app.close();
  });

  it("Status und Sitzungsansicht referenzieren dieselbe Resolution", async () => {
    const { app, auth } = await angemeldeteApp();
    const { sessionId, headers } = await registriert(app, auth);
    const status = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
    const session = await app.inject({
      method: "GET",
      url: `/api/klara/sessions/${sessionId}`,
      headers,
    });
    expect(status.json().resolutionId).toBe(session.json().resolution.resolutionId);
    expect(status.json().policyVersion).toBe(session.json().policyVersion);
    expect(status.json().configurationVersion).toBe(session.json().configurationVersion);
    await app.close();
  });
});

describe("W1 S4 R2 · Sitzung, Zustimmung, Widerruf, Schliessen über HTTP", () => {
  it("anlegen → lesen → schliessen", async () => {
    const { app, auth } = await angemeldeteApp();
    const { sessionId, headers } = await registriert(app, auth);
    const gelesen = await app.inject({
      method: "GET",
      url: `/api/klara/sessions/${sessionId}`,
      headers,
    });
    expect(gelesen.statusCode).toBe(200);
    expect(gelesen.json().sessionId).toBe(sessionId);

    const zu = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${sessionId}/close`,
      headers,
    });
    expect(zu.statusCode).toBe(200);
    expect(zu.json().closed).toBe(true);
    await app.close();
  });

  it("FREMDE Instanz/Dokument kann die Sitzung nicht lesen", async () => {
    const { app, auth } = await angemeldeteApp();
    const { sessionId, headers } = await registriert(app, auth);
    for (const fremd of [
      { ...headers, "x-klara-instance": "instanz-2" },
      { ...headers, "x-klara-document": "doc-s-fremd" },
    ]) {
      const res = await app.inject({
        method: "GET",
        url: `/api/klara/sessions/${sessionId}`,
        headers: fremd,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("NOT_FOUND");
    }
    await app.close();
  });

  it("Zustimmung ohne External-Resolution wird abgelehnt", async () => {
    const { app, auth } = await angemeldeteApp();
    const { sessionId, headers } = await registriert(app, auth);
    const consent = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${sessionId}/consent`,
      headers,
    });
    expect(consent.statusCode).toBe(409);
    expect(consent.json().error).toBe("CONFLICT");
    await app.close();
  });

  it("Widerruf ist auch ohne erteilte Zustimmung gefahrlos und wirkt sofort", async () => {
    const { app, auth } = await angemeldeteApp();
    const { sessionId, headers } = await registriert(app, auth);
    const weg = await app.inject({
      method: "DELETE",
      url: `/api/klara/sessions/${sessionId}/consent`,
      headers,
    });
    expect(weg.statusCode).toBe(200);
    expect(weg.json().resolution.externalConsentGranted).toBe(false);
    await app.close();
  });
});

describe("W1 S4 R2 · keine Secrets, keine internen Regeln im Response", () => {
  it("weder Status noch Sitzung geben Schlüssel, Token oder Policyinterna aus", async () => {
    const { app, auth } = await angemeldeteApp();
    const { res: neu, headers } = await registriert(app, auth);
    const status = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });

    for (const res of [status, neu]) {
      for (const verboten of [
        /sk-[A-Za-z0-9]/,
        /secret/i,
        /apiKey/i,
        /"token"/i,
        /Bearer /,
        /password/i,
        /allowedModes/i,
        /policyProfile/i,
      ]) {
        expect(res.payload, `Leck: ${verboten}`).not.toMatch(verboten);
      }
    }
    await app.close();
  });
});
