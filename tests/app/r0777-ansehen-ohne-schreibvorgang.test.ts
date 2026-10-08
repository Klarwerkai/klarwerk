import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ================================================================================================
// R-0777 — ANSEHEN LÖST KEINEN SCHREIBVORGANG AUS (Altbestand F-0777 · JOB 2688 D1)
// ================================================================================================
//
// Der Dienst unterlässt den Touch binnen 60 s (`KLARA_TOUCH_MINDESTABSTAND_MS`, belegt in
// `job2688-klara-jedes-hinsehen-ist-ein-schreibvorgang.test.ts`). Offen war laut Register „Einbau
// und Wirkung nicht belegt". Dieser Fall misst die Wirkung über die ECHTE Kompositionswurzel und
// die beiden Lesewege des Panels (`GET /api/klara/ai-status`, `GET /api/klara/sessions/:id`):
// wiederholtes Ansehen schreibt weder die Sitzungsablage noch das Prüfprotokoll.

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
