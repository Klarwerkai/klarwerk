import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditService, PgAuditRepo } from "../../audit";
import { PgKlaraSessionRepo } from "../../reasoner";
import { createPool, migrate } from "./db";
import { starteKlaraAufraeumen } from "./klara-aufraeumen";
import {
  KLARA_CONSENT_AUDIT_ENDED,
  KLARA_CONSENT_AUDIT_GRANTED,
  type KlaraEinwilligungsProtokoll,
  type KlaraPolicyQuelle,
  KlaraSessionService,
} from "./services/klara-session-service";
import type { IntervalHandle } from "./trash-sweep-scheduler";

// ================================================================================================
// R-0609 · Bens B14 — DER NACHTRAG VOR DEM LÖSCHEN, GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// Die B12-/B13-Fälle (`services/klara-consent-protokoll.test.ts`, `klara-aufraeumen.test.ts`) laufen
// gegen Ablagen im Arbeitsspeicher. Hier fahren DIESELBEN Szenarien mit den produktiven Adaptern:
// `PgKlaraSessionRepo` für Sitzungen und Zustimmungszeilen, `AuditService` über `PgAuditRepo` für
// das Prüfprotokoll, beide auf einer Datenbank, die `migrate()` angelegt hat. Gemessen wird:
//   · der fehlende Endeintrag wird nachgetragen, SOLANGE die Sitzungszeile noch steht, und erst
//     danach sind Sitzung und Zustimmungszeilen gelöscht;
//   · der Nachweis überdauert das Löschen (zurückgelesen über eine FRISCHE Verbindung);
//   · fällt das Protokoll beim Aufräumen aus, wird nichts gelöscht, und der nächste Lauf trägt
//     genau einmal nach.
// Ausgelöst wird das Aufräumen über `starteKlaraAufraeumen` (Startlauf und Tick), den Auslöser
// aus `server.ts`. Braucht Docker (Testcontainers); läuft unter `vitest.integration.config.ts`.

const T0 = Date.parse("2026-10-01T09:00:00.000Z");
const TAGE_32 = 32 * 24 * 60 * 60 * 1000;

const CLOUD: KlaraPolicyQuelle = {
  choice: "cloud",
  source: "default",
  effectiveAnswerProvider: "cloud",
  cloudConfigured: true,
  localConfigured: false,
  providerLabel: "Cloud-Anbieter",
  modelLabel: "cloud-modell",
  localProviderLabel: "Lokaler Anbieter",
  zentralFreigegeben: true,
};

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

describe("R-0609 · Bens B14: Nachtrag und Löschen mit PgKlaraSessionRepo und PgAuditRepo", () => {
  let container: StartedTestContainer;
  let url = "";

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    const pool = createPool(url);
    try {
      await migrate(pool);
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await container?.stop();
  });

  /**
   * Der produktive Aufbau gegen PostgreSQL, mit einem Schalter vor dem echten Prüfprotokoll:
   * `endeAusfall` lässt nur Endeinträge scheitern, `nachErteilung` hält NACH einem geschriebenen
   * Erteilungseintrag an, und jeder geschriebene Endeintrag notiert, ob die Sitzungszeile in diesem
   * Augenblick noch in der Datenbank stand.
   */
  async function aufbau(praefix: string) {
    const pool = createPool(url);
    const uhr = { jetzt: T0 };
    const audit = new AuditService({ repo: new PgAuditRepo(pool), now: () => uhr.jetzt });
    const lage = {
      endeAusfall: false,
      nachErteilung: null as (() => Promise<void>) | null,
      sitzungStandBeimEnde: [] as number[],
    };
    let beobachteteSitzung = "";
    const sitzungZeilen = async (sessionId: string): Promise<number> => {
      const res = await pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM klara_sessions WHERE session_id=$1",
        [sessionId],
      );
      return Number(res.rows[0]?.n ?? "-1");
    };
    const protokoll: KlaraEinwilligungsProtokoll = {
      async recordOnce(eventId, input) {
        if (input.action === KLARA_CONSENT_AUDIT_ENDED) {
          if (lage.endeAusfall) {
            throw new Error("Protokoll nicht erreichbar");
          }
          if (beobachteteSitzung) {
            lage.sitzungStandBeimEnde.push(await sitzungZeilen(beobachteteSitzung));
          }
        }
        const geschrieben = await audit.recordOnce(eventId, input);
        if (input.action === KLARA_CONSENT_AUDIT_GRANTED && lage.nachErteilung) {
          await lage.nachErteilung();
        }
        return geschrieben;
      },
      exists: (filter) => audit.exists(filter),
      list: (filter) => audit.list(filter),
    };
    let zaehler = 0;
    const dienst = new KlaraSessionService({
      repo: new PgKlaraSessionRepo(pool),
      policy: () => CLOUD,
      now: () => uhr.jetzt,
      newId: () => `${praefix}-${++zaehler}`,
      protokoll,
    });
    const s = await dienst.createSession("anna", "instanz-1", {
      kind: "saved",
      hostDocumentId: `${praefix}-dokument`,
    });
    const bindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: s.documentContextId,
    };
    const consentZeilen = async (): Promise<number> => {
      const res = await pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM klara_session_consents WHERE session_id=$1",
        [s.sessionId],
      );
      return Number(res.rows[0]?.n ?? "-1");
    };
    /** Endeinträge DIESER Sitzung, zurückgelesen über eine frische Verbindung. */
    const endenFrisch = async () => {
      const frisch = createPool(url);
      try {
        const alle = await new AuditService({ repo: new PgAuditRepo(frisch) }).list({
          action: KLARA_CONSENT_AUDIT_ENDED,
        });
        return alle.map((e) => e.payload).filter((p) => p.sessionId === s.sessionId);
      } finally {
        await frisch.end();
      }
    };
    return {
      pool,
      uhr,
      audit,
      lage,
      dienst,
      sessionId: s.sessionId,
      bindung,
      beobachte: () => {
        beobachteteSitzung = s.sessionId;
      },
      sitzungZeilen: () => sitzungZeilen(s.sessionId),
      consentZeilen,
      endenFrisch,
    };
  }

  /** Startet den Auslöser aus `server.ts` und hält jeden angestossenen Lauf fest. */
  function ausloeser(lauf: () => Promise<number>) {
    const laeufe: Promise<number>[] = [];
    const warnungen: string[] = [];
    const z = zeitgeber();
    starteKlaraAufraeumen({
      lauf: () => {
        const p = lauf();
        laeufe.push(p);
        return p;
      },
      intervalMs: 60_000,
      log: { info: () => undefined, warn: (_felder, t) => warnungen.push(t) },
      ...z,
    });
    return { laeufe, warnungen, tick: z.tick };
  }

  it("B12-Lage: nie wirksame Erteilung, Protokollausfall — Nachtrag `nicht_wirksam` vor dem Löschen, genau einmal", async () => {
    const a = await aufbau("b14-grant");
    try {
      // Das Rennen aus B12: Erteilungseintrag steht, ein Umbinden gewinnt, der Endeintrag fällt aus.
      let weiter: () => void = () => undefined;
      let erreicht: () => void = () => undefined;
      const steht = new Promise<void>((r) => {
        erreicht = r;
      });
      a.lage.nachErteilung = () => {
        a.lage.nachErteilung = null;
        erreicht();
        return new Promise<void>((r) => {
          weiter = r;
        });
      };
      a.lage.endeAusfall = true;
      const erteilung = a.dienst.grantConsent(a.sessionId, a.bindung).catch((e) => e);
      await steht;
      await a.dienst.rebindDocumentContext(a.sessionId, a.bindung, {
        kind: "saved",
        hostDocumentId: "b14-grant-neu",
      });
      weiter();
      expect((await erteilung).code).toBe("CONFLICT");
      expect(await a.consentZeilen()).toBe(0);
      const [erteilt] = (await a.audit.list({ action: KLARA_CONSENT_AUDIT_GRANTED })).filter(
        (e) => e.payload.sessionId === a.sessionId,
      );
      expect(erteilt).toBeDefined();
      expect(await a.endenFrisch()).toEqual([]);

      // 32 Tage später. Der Startlauf trifft das Protokoll noch ausgefallen: NICHTS wird gelöscht.
      a.uhr.jetzt = T0 + TAGE_32;
      a.beobachte();
      const t = ausloeser(() => a.dienst.raeumeAbgelaufeneAuf());
      expect(t.laeufe).toHaveLength(1);
      await expect(t.laeufe[0]).rejects.toThrow("Protokoll nicht erreichbar");
      expect(await a.sitzungZeilen()).toBe(1);
      expect(await a.endenFrisch()).toEqual([]);

      // Protokoll wieder da: der nächste Tick trägt nach — während die Sitzungszeile noch steht —
      // und löscht erst danach.
      a.lage.endeAusfall = false;
      t.tick();
      expect(t.laeufe).toHaveLength(2);
      expect(await t.laeufe[1]).toBeGreaterThanOrEqual(1);
      expect(a.lage.sitzungStandBeimEnde).toEqual([1]);
      expect(await a.sitzungZeilen()).toBe(0);
      expect(await a.consentZeilen()).toBe(0);
      expect(await a.endenFrisch()).toEqual([
        expect.objectContaining({
          consentId: erteilt?.payload.consentId,
          sessionId: a.sessionId,
          status: "nicht_wirksam",
          endedAt: erteilt?.payload.grantedAt,
        }),
      ]);

      // Weitere Ticks erfinden nichts dazu; die Hash-Kette in PostgreSQL bleibt gültig.
      t.tick();
      expect(await t.laeufe[2]).toBe(0);
      expect(await a.endenFrisch()).toHaveLength(1);
      expect(await a.audit.verify()).toBe(true);
    } finally {
      await a.pool.end();
    }
  });

  it("Widerruf bei Protokollausfall, kein weiterer Zugriff: `revoked` mit Widerrufszeit nachgetragen, Erteilung vollständig erhalten", async () => {
    const a = await aufbau("b14-revoke");
    try {
      await a.dienst.grantConsent(a.sessionId, a.bindung);
      expect(await a.consentZeilen()).toBe(1);
      const widerrufAm = T0 + 60_000;
      a.uhr.jetzt = widerrufAm;
      a.lage.endeAusfall = true;
      await expect(a.dienst.revokeConsent(a.sessionId, a.bindung)).rejects.toThrow(
        "Protokoll nicht erreichbar",
      );
      a.lage.endeAusfall = false;

      a.uhr.jetzt = T0 + TAGE_32;
      a.beobachte();
      const t = ausloeser(() => a.dienst.raeumeAbgelaufeneAuf());
      expect(await t.laeufe[0]).toBeGreaterThanOrEqual(1);
      expect(t.warnungen).toEqual([]);
      expect(a.lage.sitzungStandBeimEnde).toEqual([1]);
      expect(await a.sitzungZeilen()).toBe(0);
      expect(await a.consentZeilen()).toBe(0);
      expect(await a.endenFrisch()).toEqual([
        expect.objectContaining({
          sessionId: a.sessionId,
          status: "revoked",
          endedAt: new Date(widerrufAm).toISOString(),
        }),
      ]);

      // Der Nachweis der Erteilung überdauert das Löschen — mit allen R-0609-Feldern.
      const frisch = createPool(url);
      try {
        const erteilungen = (
          await new AuditService({ repo: new PgAuditRepo(frisch) }).list({
            action: KLARA_CONSENT_AUDIT_GRANTED,
          })
        ).filter((e) => e.payload.sessionId === a.sessionId);
        expect(erteilungen).toHaveLength(1);
        expect(erteilungen[0]?.actor).toBe("anna");
        expect(erteilungen[0]?.payload).toMatchObject({
          documentContextId: a.bindung.documentContextId,
          providerReference: expect.any(String),
          modelReference: expect.any(String),
          allowedPayloadClasses: expect.any(Array),
          policyVersion: expect.any(String),
          grantedAt: new Date(T0).toISOString(),
          expiresAt: expect.any(String),
        });
      } finally {
        await frisch.end();
      }
    } finally {
      await a.pool.end();
    }
  });
});
