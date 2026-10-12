import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { KLARA_TOUCH_MINDESTABSTAND_MS } from "../../services/app/src/services/klara-session-service";

// ================================================================================================
// R-0777 — ANSEHEN LÖST KEINEN SCHREIBVORGANG AUS (Altbestand F-0777 · JOB 2688 D1)
// ================================================================================================
//
// Dieser Fall misst über die ECHTE Kompositionswurzel und die beiden Lesewege des Panels
// (`GET /api/klara/ai-status`, `GET /api/klara/sessions/:id`): Ansehen schreibt weder die
// Sitzungsablage noch das Prüfprotokoll — auch NICHT jenseits des 60-s-Fensters, in dem die
// JOB-2688-Drossel bis zu Bens Befund (Kandidat 068ea4a2) wieder schrieb.
//
// Die Uhr: angehalten wird nur `Date` (der Dienst liest `Date.now()`); Zeitgeber laufen normal.
const T0 = Date.parse("2026-10-08T08:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
});

const INSTANZ = "instanz-1";
const DESCRIPTOR = { kind: "saved" as const, hostDocumentId: "word-doc-1" };

/** Alle schreibenden Operationen der Sitzungsablage — `find*`/`alle*` lesen nur. */
const SCHREIBER = [
  "insertSession",
  "touchSession",
  "rebindSession",
  "grantConsent",
  "revokeConsent",
  "closeSession",
  "invalidateSession",
  "refreshResolution",
  "purgeExpiredSessions",
] as const;

async function aufbau() {
  const services = buildServices();
  const schreibvorgaenge: string[] = [];
  const ablage = services.klaraSessions as unknown as Record<
    string,
    (...args: unknown[]) => Promise<unknown>
  >;
  for (const name of SCHREIBER) {
    const original = ablage[name];
    if (typeof original !== "function") continue;
    ablage[name] = (...args: unknown[]) => {
      schreibvorgaenge.push(name);
      return original.apply(services.klaraSessions, args);
    };
  }
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
  const auth = { authorization: `Bearer ${login.json().token as string}` };
  const neu = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: auth,
    payload: { addinInstanceId: INSTANZ, documentDescriptor: DESCRIPTOR },
  });
  expect(neu.statusCode).toBe(201);
  const sessionId = neu.json().sessionId as string;
  const headers = {
    ...auth,
    "x-klara-session": sessionId,
    "x-klara-instance": INSTANZ,
    "x-klara-document": neu.json().documentContextId as string,
  };
  return { app, services, schreibvorgaenge, sessionId, headers };
}

describe("R-0777 · Ansehen über HTTP schreibt nicht", () => {
  it("V1 · Statusabruf und Sitzungsansicht, je fünfmal: kein Schreibvorgang, keine neue Revision, kein Protokolleintrag", async () => {
    const { app, services, schreibvorgaenge, sessionId, headers } = await aufbau();
    // Die Anlage selbst ist ein fachlicher Schreibvorgang — er zählt nicht zum Ansehen.
    schreibvorgaenge.length = 0;
    const vorher = await services.klaraSessions.findSession(sessionId);
    const protokollVorher = (await services.audit.list({})).length;

    for (let i = 0; i < 5; i++) {
      const status = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
      expect(status.statusCode).toBe(200);
      const sicht = await app.inject({
        method: "GET",
        url: `/api/klara/sessions/${sessionId}`,
        headers,
      });
      expect(sicht.statusCode).toBe(200);
    }

    expect(schreibvorgaenge).toEqual([]);
    const nachher = await services.klaraSessions.findSession(sessionId);
    expect(nachher?.revision).toBe(vorher?.revision);
    expect(nachher?.lastActivityAt).toBe(vorher?.lastActivityAt);
    expect(nachher?.expiresAt).toBe(vorher?.expiresAt);
    expect((await services.audit.list({})).length).toBe(protokollVorher);
    await app.close();
  });

  it("V3 · Abrufe JENSEITS der 60-s-Grenze (je +61 s, zuletzt +10 min): weiterhin kein Schreibvorgang", async () => {
    const { app, services, schreibvorgaenge, sessionId, headers } = await aufbau();
    schreibvorgaenge.length = 0;
    const vorher = await services.klaraSessions.findSession(sessionId);
    const protokollVorher = (await services.audit.list({})).length;

    for (const versatz of [
      KLARA_TOUCH_MINDESTABSTAND_MS + 1_000,
      2 * (KLARA_TOUCH_MINDESTABSTAND_MS + 1_000),
      10 * 60 * 1000,
    ]) {
      vi.setSystemTime(T0 + versatz);
      const status = await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
      expect(status.statusCode, `Status bei +${versatz} ms`).toBe(200);
      const sicht = await app.inject({
        method: "GET",
        url: `/api/klara/sessions/${sessionId}`,
        headers,
      });
      expect(sicht.statusCode, `Sitzung bei +${versatz} ms`).toBe(200);
      // Die ausgelieferte Sicht trägt den unveränderten Stand — nichts wurde fortgeschrieben.
      expect(sicht.json().lastActivityAt).toBe(vorher?.lastActivityAt);
      expect(sicht.json().expiresAt).toBe(vorher?.expiresAt);
    }

    // Bis zu Bens Befund stand hier mindestens ein `touchSession` je Abruf nach 60 s.
    expect(schreibvorgaenge).toEqual([]);
    const nachher = await services.klaraSessions.findSession(sessionId);
    expect(nachher?.revision).toBe(vorher?.revision);
    expect(nachher?.lastActivityAt).toBe(vorher?.lastActivityAt);
    expect(nachher?.expiresAt).toBe(vorher?.expiresAt);
    expect((await services.audit.list({})).length).toBe(protokollVorher);
    await app.close();
  });

  it("V2 · Gegenprobe des Spions: eine echte Änderung (Schliessen) wird gezählt", async () => {
    const { app, schreibvorgaenge, sessionId, headers } = await aufbau();
    schreibvorgaenge.length = 0;
    const zu = await app.inject({
      method: "POST",
      url: `/api/klara/sessions/${sessionId}/close`,
      headers,
    });
    expect(zu.statusCode).toBe(200);
    expect(schreibvorgaenge).toContain("closeSession");
    await app.close();
  });
});
