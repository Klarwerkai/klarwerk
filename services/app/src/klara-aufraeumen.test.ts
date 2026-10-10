import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "./build-app";
import { starteKlaraAufraeumen } from "./klara-aufraeumen";
import {
  KLARA_CONSENT_AUDIT_ENDED,
  KLARA_CONSENT_AUDIT_GRANTED,
} from "./services/klara-session-service";
import type { IntervalHandle } from "./trash-sweep-scheduler";

// ================================================================================================
// R-0609 · Bens B13 — DER NACHTRAG FÜR NIE WIRKSAME ERTEILUNGEN LÄUFT IM BETRIEB.
// ================================================================================================
//
// Bens Gegenbeleg: `trageUnwirksameErteilungenNach` hing allein an `raeumeAbgelaufeneAuf`, und das
// rief nur ein Test. Gemessen wird hier der Produktpfad in drei Gliedern: der Zeitgeber startet den
// Lauf (Start und Tick), `buildApp` reicht den Lauf SEINER Dienstinstanz heraus, und `server.ts`
// verdrahtet beides. Die Fehlerkombination selbst (Rennen, Ausfall) misst
// `services/klara-consent-protokoll.test.ts`; hier steht ihr Endzustand: eine abgelaufene Sitzung
// mit einem Erteilungseintrag, zu dem keine Zustimmungszeile und kein Endeintrag existiert.

const TAGE_32 = 32 * 24 * 60 * 60 * 1000;
const INSTANZ = "instanz-b13";

/** Ein Zeitgeber, dessen Tick der Test selbst auslöst. */
function zeitgeber() {
  let tick: (() => void) | null = null;
  return {
    setIntervalFn: (cb: () => void): IntervalHandle => {
      tick = cb;
      return 1 as unknown as IntervalHandle;
    },
    tick: () => tick?.(),
  };
}

const stilleLogs = () => ({ info: vi.fn(), warn: vi.fn() });

afterEach(() => {
  vi.useRealTimers();
});

describe("Bens B13 · der Zeitgeber startet den Klara-Aufräumlauf", () => {
  it("einmal beim Start und danach je Tick", async () => {
    const lauf = vi.fn(async () => 0);
    const z = zeitgeber();
    starteKlaraAufraeumen({ lauf, intervalMs: 60_000, log: stilleLogs(), ...z });
    expect(lauf).toHaveBeenCalledTimes(1);
    z.tick();
    expect(lauf).toHaveBeenCalledTimes(2);
  });

  it("ein Fehler (Protokoll nicht erreichbar) wird gemeldet, nicht geworfen — der nächste Tick läuft", async () => {
    const lauf = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("Protokoll nicht erreichbar"))
      .mockResolvedValueOnce(2);
    const log = stilleLogs();
    const z = zeitgeber();
    starteKlaraAufraeumen({ lauf, intervalMs: 60_000, log, ...z });
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalledTimes(1));
    // R-0623 (Ben, Nacharbeit 3): die Ursache ist gemeldet — STRUKTURIERT als `err`, damit sie nur
    // über den Erlaubnislisten-Serializer ins Log geht; der Text ist ein fester Ereignissatz.
    const [felder, text] = log.warn.mock.calls[0] ?? [];
    expect((felder as { err?: unknown }).err).toBeInstanceOf(Error);
    expect((felder as { err: Error }).err.message).toBe("Protokoll nicht erreichbar");
    expect(String(text)).toBe("Klara-Aufräumlauf (Start) übersprungen");
    z.tick();
    await vi.waitFor(() => expect(log.info).toHaveBeenCalledTimes(1));
    expect(String(log.info.mock.calls[0]?.[0])).toContain("2 entfernt");
  });
});

describe("Bens B13 · `buildApp` reicht den Lauf seiner Dienstinstanz heraus — er erreicht den Nachtrag", () => {
  it("abgelaufene Sitzung mit nie wirksamer Erteilung: der Zeitgeber trägt `nicht_wirksam` nach und löscht", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const T0 = Date.parse("2026-10-01T09:00:00.000Z");
    vi.setSystemTime(T0);
    const services = buildServices();
    let lauf: (() => Promise<number>) | undefined;
    const app = buildApp(services, {
      klaraAufraeumen: (l) => {
        lauf = l;
      },
    });
    expect(lauf).toBeTypeOf("function");

    // Echte Sitzung über die Route.
    const email = "pedi@b13.test";
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email, password: "geheim12345" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "geheim12345" },
    });
    const auth = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
    const res = await app.inject({
      method: "POST",
      url: "/api/klara/sessions",
      headers: { ...auth, "x-klara-instance": INSTANZ },
      payload: {
        addinInstanceId: INSTANZ,
        documentDescriptor: { kind: "saved", hostDocumentId: "word-doc-b13" },
      },
    });
    expect(res.statusCode).toBe(201);
    const { sessionId } = res.json() as { sessionId: string };
    const session = await services.klaraSessions.findSession(sessionId);
    expect(session).toBeDefined();

    // Der Endzustand von B12: Erteilungseintrag steht, Zustimmungszeile und Endeintrag fehlen.
    const consentId = "b13-nie-wirksam";
    const grantedAt = new Date(T0).toISOString();
    await services.audit.recordOnce(`${KLARA_CONSENT_AUDIT_GRANTED}:${consentId}`, {
      actor: session?.actorId ?? "",
      action: KLARA_CONSENT_AUDIT_GRANTED,
      target: `klara-consent:${consentId}`,
      payload: {
        consentId,
        sessionId,
        documentContextId: session?.documentContextId,
        providerReference: "anthropic",
        grantedAt,
        expiresAt: new Date(T0 + 60 * 60 * 1000).toISOString(),
      },
    });
    expect(await services.klaraSessions.alleConsents(sessionId)).toHaveLength(0);

    // 32 Tage später, über den Produktpfad: Zeitgeber → Lauf aus `buildApp`.
    vi.setSystemTime(T0 + TAGE_32);
    const log = stilleLogs();
    const z = zeitgeber();
    // Jeder Lauf, den der Zeitgeber anstösst, wird festgehalten — so wartet der Test genau auf ihn.
    const laeufe: Promise<number>[] = [];
    const ausBuildApp = lauf;
    if (!ausBuildApp) {
      throw new Error("buildApp hat keinen Lauf registriert");
    }
    starteKlaraAufraeumen({
      lauf: () => {
        const p = ausBuildApp();
        laeufe.push(p);
        return p;
      },
      intervalMs: 60_000,
      log,
      ...z,
    });
    expect(laeufe).toHaveLength(1);
    expect(await laeufe[0]).toBe(1);
    expect(await services.klaraSessions.findSession(sessionId)).toBeUndefined();
    const enden = await services.audit.list({ action: KLARA_CONSENT_AUDIT_ENDED });
    expect(enden.map((e) => e.payload)).toEqual([
      expect.objectContaining({
        consentId,
        sessionId,
        status: "nicht_wirksam",
        endedAt: grantedAt,
      }),
    ]);
    expect(log.warn).not.toHaveBeenCalled();
    // Der nächste Tick erfindet nichts dazu.
    z.tick();
    expect(laeufe).toHaveLength(2);
    expect(await laeufe[1]).toBe(0);
    expect(await services.audit.list({ action: KLARA_CONSENT_AUDIT_ENDED })).toHaveLength(1);
    await app.close();
  });
});

describe("Bens B13 · `server.ts` verdrahtet den Lauf", () => {
  it("buildApp bekommt `klaraAufraeumen`, und der Lauf geht an `starteKlaraAufraeumen`", () => {
    const quelle = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
    expect(quelle).toMatch(/buildApp\(services, \{[^}]*klaraAufraeumen: \(lauf\) => \{/);
    expect(quelle).toMatch(/klaraAufraeumLauf = lauf;/);
    expect(quelle).toMatch(/starteKlaraAufraeumen\(\{\s*lauf: klaraAufraeumLauf,/);
  });
});
