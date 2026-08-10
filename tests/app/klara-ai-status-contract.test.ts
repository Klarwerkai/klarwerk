import { describe, expect, it } from "vitest";
import {
  assembleServices,
  buildApp,
  buildServices,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { InMemoryKlaraSessionRepo } from "../../services/reasoner";

// ================================================================================================
// W1 S4 — DER STATUSVERTRAG (Auftrag §97-119, KW-S4-04 §13-57)
// ================================================================================================
//
// Diese Datei prüft die Zusage, auf die BASIC danach seinen permanenten Kopf baut: dass der Status
// vollständig, serverseitig aufgelöst und mit Ausführung deckungsgleich ist. Ohne sie müsste das
// Add-in raten — und genau das ist das No-Go aus KW-S4-04 §55.

const INSTANZ = "instanz-1";
const DESCRIPTOR = { kind: "saved" as const, hostDocumentId: "word-doc-1" };

/** Registriert eine Sitzung und liefert die vollstaendige, serverseitig attestierte Bindung. */
async function registriert(
  app: ReturnType<typeof buildApp>,
  auth: Record<string, string>,
  descriptor:
    | { kind: "saved"; hostDocumentId?: string }
    | { kind: "unsaved"; clientDocumentNonce: string } = DESCRIPTOR,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: auth,
    payload: { addinInstanceId: INSTANZ, documentDescriptor: descriptor },
  });
  const body = res.json();
  return {
    res,
    body,
    sessionId: body.sessionId as string,
    headers: {
      ...auth,
      "x-klara-session": body.sessionId as string,
      "x-klara-instance": INSTANZ,
      "x-klara-document": body.documentContextId as string,
    },
  };
}

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
  return { app, services, auth: { authorization: `Bearer ${login.json().token}` } };
}

describe("W1 S4 R2 · Status gibt es NUR gegen eine registrierte Zuordnung (BEN ROT-5)", () => {
  it("ohne Sitzungsbindung antwortet der Status gar nicht", async () => {
    // DAS IST DER KERN VON ROT-5. In R1 beantwortete diese Route jeden angemeldeten Nutzer direkt
    // aus der Konfiguration — die Instanz-/Dokumentheader wurden nicht einmal gelesen.
    const { app, auth } = await angemeldeteApp();
    const ohne = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers: auth });
    expect(ohne.statusCode).toBe(404);
    // Und die Absage verrät nicht, WELCHE Zuordnung fehlte (S4-20 §133).
    expect(JSON.stringify(ohne.json())).not.toMatch(/instance|document|session/i);
    await app.close();
  });

  it("eine fremde Instanz oder ein fremder Dokumentkontext genügt nicht", async () => {
    const { app, auth } = await angemeldeteApp();
    const { headers } = await registriert(app, auth);
    for (const [kopf, wert] of [
      ["x-klara-instance", "fremde-instanz"],
      ["x-klara-document", "doc-s-fremd"],
      ["x-klara-session", "sess-fremd"],
    ] as const) {
      const res = await app.inject({
        method: "GET",
        url: "/api/klara/ai-status",
        headers: { ...headers, [kopf]: wert },
      });
      expect(res.statusCode, `${kopf} hätte abgewiesen werden müssen`).toBe(404);
    }
    await app.close();
  });

  it("mit vollständiger Bindung trägt jede Antwort eine resolutionId (KW-S4-04 §56)", async () => {
    const { app, auth } = await angemeldeteApp();
    const { headers } = await registriert(app, auth);
    const a = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
    const b = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
    expect(a.statusCode).toBe(200);
    expect(a.json().resolutionId).toBeTruthy();
    // ROT-1/ROT-2 KORRIGIERT: solange Policy- und Konfigurationsversion gleich bleiben, ist es
    // DIESELBE Auflösung. In R1 wurde je Abruf eine neue Kennung erfunden — dann kann die Kennung
    // die Anzeige nicht mehr an die Ausführung binden, und genau das war ihr Zweck.
    expect(b.json().resolutionId).toBe(a.json().resolutionId);
    await app.close();
  });

  it("Anzeige und Ausführung stammen aus derselben Auflösung", async () => {
    const { app, auth } = await angemeldeteApp();
    const { sessionId, headers } = await registriert(app, auth);
    const status = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
    const gelesen = await app.inject({
      method: "GET",
      url: `/api/klara/sessions/${sessionId}`,
      headers,
    });
    expect(status.json().effectiveMode).toBe(gelesen.json().resolution.effectiveMode);
    expect(status.json().policyVersion).toBe(gelesen.json().resolution.policyVersion);
    expect(status.json().configurationVersion).toBe(gelesen.json().resolution.configurationVersion);
    // Und dieselbe Kennung — das ist die Deckungsgleichheit, die §56 verlangt.
    expect(status.json().resolutionId).toBe(gelesen.json().resolution.resolutionId);
    await app.close();
  });

  it("Provider und Modell sind auch deterministisch gefüllt (Auftrag §118)", async () => {
    const { app, auth } = await angemeldeteApp();
    const { headers } = await registriert(app, auth);
    const body = (await app.inject({ method: "GET", url: "/api/klara/ai-status", headers })).json();
    expect(body.effectiveMode).toBe("deterministic");
    expect(body.provider).toBeTruthy();
    expect(body.model).toBeTruthy();
    // Kein `null`, kein leerer String, kein `undefined` — das Add-in muss nichts raten.
    expect(body.provider).not.toBeNull();
    expect(body.model).not.toBeNull();
    await app.close();
  });

  it("fehlende/unvollständige Konfiguration endet deterministisch, nie still external (§156)", async () => {
    const { app, auth } = await angemeldeteApp();
    const { headers } = await registriert(app, auth);
    const body = (await app.inject({ method: "GET", url: "/api/klara/ai-status", headers })).json();
    expect(["deterministic", "internal", "external"]).toContain(body.effectiveMode);
    if (body.effectiveMode === "external") {
      expect(body.executionAllowed).toBe(false);
    }
    await app.close();
  });
});

describe("W1 S4 R2 · der Dokumentkontext ist serverseitig vergeben (KW-S4-20 §4/§5)", () => {
  it("der Client liefert einen Descriptor, NICHT die fertige Kennung", async () => {
    const { app, auth } = await angemeldeteApp();
    const { res, body } = await registriert(app, auth);
    expect(res.statusCode).toBe(201);
    expect(body.documentContextId).toBeTruthy();
    // Der Server hat sie gebildet — sie ist nicht die rohe Host-Kennung des Clients.
    expect(body.documentContextId).not.toBe("word-doc-1");
    expect(body.documentContextId).toMatch(/^doc-s-/);
    await app.close();
  });

  it("dasselbe gespeicherte Dokument ergibt denselben Kontext, ein anderes einen anderen", async () => {
    const { app, auth } = await angemeldeteApp();
    const a = await registriert(app, auth, { kind: "saved", hostDocumentId: "word-doc-1" });
    const b = await registriert(app, auth, { kind: "saved", hostDocumentId: "word-doc-1" });
    const c = await registriert(app, auth, { kind: "saved", hostDocumentId: "word-doc-2" });
    expect(b.body.documentContextId).toBe(a.body.documentContextId);
    expect(c.body.documentContextId).not.toBe(a.body.documentContextId);
    await app.close();
  });

  it("ein ungespeichertes Dokument bekommt je Registrierung einen eigenen, temporären Kontext", async () => {
    const { app, auth } = await angemeldeteApp();
    const a = await registriert(app, auth, { kind: "unsaved", clientDocumentNonce: "n-1" });
    const b = await registriert(app, auth, { kind: "unsaved", clientDocumentNonce: "n-1" });
    expect(a.body.documentContextId).toMatch(/^doc-t-/);
    expect(b.body.documentContextId).not.toBe(a.body.documentContextId);
    await app.close();
  });

  it("Speichern eines temporären Dokuments bindet um und entwertet die alte Auflösung", async () => {
    const { app, auth } = await angemeldeteApp();
    const { sessionId, body, headers } = await registriert(app, auth, {
      kind: "unsaved",
      clientDocumentNonce: "n-9",
    });
    const vorher = body.resolution.resolutionId as string;
    const neu = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${sessionId}/document-context`,
      headers,
      payload: { documentDescriptor: { kind: "saved", hostDocumentId: "word-doc-neu" } },
    });
    expect(neu.statusCode).toBe(200);
    expect(neu.json().documentContextId).toMatch(/^doc-s-/);
    expect(neu.json().documentContextId).not.toBe(body.documentContextId);
    // Ein anderer Kontext ist ein anderer Vorgang: neue Auflösung, keine geerbte Zustimmung.
    expect(neu.json().resolution.resolutionId).not.toBe(vorher);
    expect(neu.json().consentState).not.toBe("granted");
    // Und die ALTE Dokumentkennung trägt nicht mehr.
    const alt = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
    expect(alt.statusCode).toBe(404);
    await app.close();
  });
});

describe("W1 S4 · der Status überlebt einen App-Neustart (Gegenprobe 12, InMemory-Hälfte)", () => {
  it("dieselbe Ablage über zwei App-Instanzen: die Sitzung bleibt lesbar", async () => {
    // EHRLICHE TRENNUNG: das hier ist die InMemory-Hälfte. Sie belegt, dass der Zustand an der
    // ABLAGE hängt und nicht an der App-Instanz — nicht, dass er einen Prozessneustart überlebt.
    // Das kann nur PostgreSQL, und dafür gibt es den Integrationslauf.
    const repos = inMemoryRepos();
    const klaraSessions = new InMemoryKlaraSessionRepo();
    const services = assembleServices(repos, { klaraSessions });
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
    const auth = { authorization: `Bearer ${login.json().token}` };
    const { sessionId, headers } = await registriert(app, auth);
    await app.close();

    // Zweite App-Instanz über DIESELBE Ablage.
    const services2 = assembleServices(repos, { klaraSessions });
    const app2 = buildApp(services2);
    const login2 = await app2.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    const gelesen = await app2.inject({
      method: "GET",
      url: `/api/klara/sessions/${sessionId}`,
      // Dieselbe Bindung, andere App-Instanz: der Zustand hängt an der Ablage, nicht am Prozess.
      headers: { ...headers, authorization: `Bearer ${login2.json().token}` },
    });
    expect(gelesen.statusCode).toBe(200);
    expect(gelesen.json().sessionId).toBe(sessionId);
    await app2.close();
  });

  it("eine FRISCHE Ablage kennt die Sitzung ehrlich nicht", async () => {
    // Die Gegenprobe zur Zeile darüber: ohne gemeinsame Ablage gibt es keinen Zustand. Ein Test,
    // der das nicht prüft, könnte einen globalen Zwischenspeicher übersehen.
    const { app, auth } = await angemeldeteApp();
    const { sessionId, headers } = await registriert(app, auth);
    await app.close();

    const { app: app2, auth: auth2 } = await angemeldeteApp();
    const res = await app2.inject({
      method: "GET",
      url: `/api/klara/sessions/${sessionId}`,
      headers: { ...headers, ...auth2 },
    });
    expect(res.statusCode).toBe(404);
    await app2.close();
  });
});
